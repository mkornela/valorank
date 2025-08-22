const express = require('express');
const router = express.Router();
const { VALID_REGIONS, RANK_TIERS, TEAMS, EVENTS, RANK_ELO_THRESHOLDS } = require('../constants');
const { logToDiscord } = require('../utils/discord');
const { getSessionTimeRange, formatMatchDateTimeShort, getTimeUntilMatch, formatMatchDateTimeShortHour } = require('../utils/time');
const { fetchAccountDetails, fetchMatchHistory, fetchPlayerMMR, fetchLeaderboard, fetchMMRHistory, fetchMMRHistoryDaily } = require('../services/api');
const { findPlayerByRank } = require('../data/leaderboard');
const { calculateRRToGoal, calculateSessionStats } = require('../services/game');
const log = require('../utils/logger');

const { VlrClient } = require('vlr-client');
const vlr = new VlrClient();

const asyncHandler = fn => (req, res, next) => {
    return Promise
        .resolve(fn(req, res, next))
        .catch(next);
};

const calculateEloToCustomGoal = (currentElo, goalRank) => {
    const goalElo = RANK_ELO_THRESHOLDS[goalRank];
    if (goalElo === undefined) {
        return null; // Nieprawidłowa nazwa rangi
    }
    
    const eloNeeded = goalElo - currentElo;
    return {
        eloNeeded: Math.max(0, eloNeeded), // Nie może być ujemne
        goalElo: goalElo,
        alreadyReached: eloNeeded <= 0
    };
};

const deduplicateMatches = (matchHistory) => {
    if (!matchHistory || !matchHistory.data || !Array.isArray(matchHistory.data)) {
        return matchHistory;
    }
    
    const seen = new Set();
    const uniqueMatches = matchHistory.data.filter(match => {
        const matchId = match.meta?.matchid;
        if (!matchId) return true;
        
        if (seen.has(matchId)) {
            return false;
        }
        seen.add(matchId);
        return true;
    });
    
    if (uniqueMatches.length < matchHistory.data.length) {
        const duplicateCount = matchHistory.data.length - uniqueMatches.length;
        log.info('DEDUP', `Removed ${duplicateCount} duplicate matches from API response`);
    }
    
    return {
        ...matchHistory,
        data: uniqueMatches
    };
};

router.get('/api/rank', asyncHandler(async (req, res, next) => {
    const { STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION } = require('../config');
    
    const mmrData = await fetchPlayerMMR(STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION);
    
    if (mmrData && mmrData.data) {
        res.json(mmrData.data);
    } else {
        res.status(404).json({ error: 'Nie znaleziono danych MMR.' });
    }
}));

function findPlayer(leaderboard, name, tag) {
    let player = leaderboard.find(player => player.name === name && player.tag === tag);
    if(!player) return 'Not found';
    return player;
}

router.get('/rank/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { text = "{rank} {rr}RR | Daily: {wl} ({dailyRR}RR) | Last: {lastRR}RR", resetTime, goalRank } = req.query;

    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }

    const [mmr, /*leaderboard,*/ account, rawHistory, mmrHistory] = await Promise.all([
        fetchPlayerMMR(name, tag, region),
        //fetchLeaderboard(region),
        fetchAccountDetails(name, tag),
        fetchMatchHistory(name, tag, region, 'competitive', 25),
        fetchMMRHistoryDaily(name, tag, region)
    ]);
    console.log({
        mmr,
        account,
        rawHistory,
        mmrHistory
    })

    let lastStatsRaw;
    rawHistory.data[0].players.forEach(player => {
        if(player.name == name) lastStatsRaw = player;
    })

    if (!mmr.data || !mmr.data.current_data) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza lub brak danych rankingowych.');
    }
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono konta gracza dla statystyk dziennych.');
    }

    const history = deduplicateMatches(rawHistory);

    const { currenttier, ranking_in_tier, elo } = mmr.data.current_data;
    
    let rr, goal, rrToGoal;
    
    if (goalRank) {
        const customGoal = calculateEloToCustomGoal(elo, goalRank);
        if (customGoal === null) {
            return res.status(400).type('text/plain').send(`Błąd: Nieprawidłowa nazwa rangi "${goalRank}". Dostępne rangi: ${Object.keys(RANK_ELO_THRESHOLDS).join(', ')}`);
        }
        
        rrToGoal = customGoal.eloNeeded;
        goal = goalRank;
        rr = rrToGoal;
        
        if (customGoal.alreadyReached) {
            goal = `${goalRank} (już osiągnięte!)`;
            rrToGoal = 0;
        }
    } else {
        const originalGoal = calculateRRToGoal(currenttier, ranking_in_tier || 0);
        rr = originalGoal.rr;
        goal = originalGoal.goal;
        rrToGoal = rr;
    }

    const { startTime, endTime } = getSessionTimeRange(null, resetTime);
    const mmrHistoryArray = mmrHistory?.data?.history || [];

    let { wins, losses, draws, lastMatchRR, totalRRChange } = calculateSessionStats(history, mmrHistoryArray, account.data.puuid, startTime, endTime);

    const wlString = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
    const dailyRRFormatted = totalRRChange >= 0 ? `+${totalRRChange}` : totalRRChange.toString();
    const lastRRFormatted = lastMatchRR !== null ? (lastMatchRR >= 0 ? `+${lastMatchRR}` : lastMatchRR.toString()) : '-';

    const lastStats = `${lastStatsRaw.stats.kills}/${lastStatsRaw.stats.deaths}/${lastStatsRaw.stats.assists}`;
    const lastAgent = lastStatsRaw.agent.name;

    //let playerLB = await findPlayer(leaderboard.data.players, name, tag);
    //if(playerLB != 'Not found') {
    //    playerLB = `#${playerLB.leaderboard_rank}`;
    //} else {
        playerLB = ``;
    //}
    
    let finalText = text
        .replace(/{name}/g, name)
        .replace(/{tag}/g, tag)
        .replace(/{lb}/g, playerLB)
        .replace(/{rank}/g, RANK_TIERS[currenttier] || "Unknown")
        .replace(/{rr}/g, (ranking_in_tier || 0).toString())
        .replace(/{rrToGoal}/g, rrToGoal.toString())
        .replace(/{goal}/g, goal)
        .replace(/{wl}/g, wlString)
        .replace(/{dailyRR}/g, dailyRRFormatted)
        .replace(/{lastRR}/g, lastRRFormatted)
        .replace(/{lastStats}/g, lastStats)
        .replace(/{lastAgent}/g, lastAgent);

    const isRadiant = currenttier === 27;
    if (isRadiant && !goalRank) {
        finalText = finalText.replace(/{rrToGoal}RR do {goal}/g, "Gratulacje Radianta!");
    }
    
    // Jeśli cel został już osiągnięty, zastąp komunikat
    if (goalRank && rrToGoal === 0) {
        finalText = finalText.replace(/{rrToGoal}RR do {goal}/g, `Cel "${goalRank}" już osiągnięty!`);
    }
    
    res.type('text/plain').send(finalText);
    logToDiscord({ 
        title: 'API Call Success: `/rank` (extended)', 
        color: 0x00FF00, 
        fields: [
            { name: 'Player', value: `\`${name}#${tag}\``, inline: true }, 
            { name: 'Custom Goal', value: goalRank ? `\`${goalRank}\`` : 'Default (next rank)', inline: true },
            { name: 'Result', value: `\`${finalText}\``, inline: false }
        ], 
        timestamp: new Date().toISOString(), 
        footer: { text: `IP: ${req.ip}` } 
    });
}));

router.get('/rankraw/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;

    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }

    const [mmr, account] = await Promise.all([
        fetchPlayerMMR(name, tag, region),
        fetchAccountDetails(name, tag)
    ]);
    
    res.type('text/plain').send({ mmr, account });
    logToDiscord({ 
        title: 'API Call Success: `/rankraw` (extended)', 
        color: 0x00FF00, 
        fields: [
            { name: 'Player', value: `\`${name}#${tag}\``, inline: true }, 
            { name: 'Result', value: `\`${ mmr, account }\``, inline: false }
        ], 
        timestamp: new Date().toISOString(), 
        footer: { text: `IP: ${req.ip}` } 
    });
}));

router.get('/wl/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { resetTime, sessionStart } = req.query;
    
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }
    
    const [account, rawHistory, mmrHistory] = await Promise.all([
        fetchAccountDetails(name, tag), 
        fetchMatchHistory(name, tag, region, 'competitive', 20),
        fetchMMRHistory(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
    }
    
    const history = deduplicateMatches(rawHistory);
    
    const mmrHistoryArray = mmrHistory?.data || [];
    const { startTime, endTime } = getSessionTimeRange(sessionStart ? parseInt(sessionStart, 10) * 1000 : null, resetTime);
    const { wins, losses, draws } = calculateSessionStats(history, mmrHistoryArray, account.data.puuid, startTime, endTime);
    
    const result = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
    res.type('text/plain').send(result);
    logToDiscord({ title: 'API Call Success: `/wl`', color: 0x00FF00, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Result', value: `\`${result}\``, inline: false }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
}));

router.get('/advanced_wl/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { resetTime } = req.query;
    
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }
    
    const [account, rawHistory, mmrHistory] = await Promise.all([ 
        fetchAccountDetails(name, tag), 
        fetchMatchHistory(name, tag, region, 'competitive', 25), 
        fetchMMRHistory(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
    }
    
    const history = deduplicateMatches(rawHistory);
    
    const { startTime, endTime } = getSessionTimeRange(null, resetTime);
    const mmrHistoryArray = mmrHistory?.data || [];
    let { wins, losses, draws, lastMatchResult, lastMatchRR } = calculateSessionStats(history, mmrHistoryArray, account.data.puuid, startTime, endTime);
    
    let result = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
    if (lastMatchResult) {
        result += ` (Last:`;
        if (lastMatchRR != null) { result += ` ${lastMatchRR >= 0 ? '+' : ''}${lastMatchRR}RR`; }
        result += ')';
    }
    res.type('text/plain').send(result);
    logToDiscord({ title: 'API Call Success: `/advanced_wl`', color: 0x00FF00, fields: [{ name: 'Player', value: `\`${name}#${tag}\``}, { name: 'Result', value: `\`${result}\`` }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
}));

router.get('/daily/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { resetTime } = req.query;

    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }

    const [account, rawHistory, mmr, mmrHistory] = await Promise.all([
        fetchAccountDetails(name, tag),
        fetchMatchHistory(name, tag, region, 'competitive', 25),
        fetchPlayerMMR(name, tag, region),
        fetchMMRHistoryDaily(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
    }
    if (!mmr.data?.current_data) {
        return res.status(404).type('text/plain').send('Błąd: Brak danych rankingowych dla gracza.');
    }

    const history = deduplicateMatches(rawHistory);

    const { startTime, endTime } = getSessionTimeRange(null, resetTime);
    const mmrHistoryArray = mmrHistory?.data?.history || [];
    let { wins, losses, draws, lastMatchRR, totalRRChange } = calculateSessionStats(history, mmrHistoryArray, account.data.puuid, startTime, endTime);
    
    const { currenttier, ranking_in_tier } = mmr.data.current_data;
    const rankName = RANK_TIERS[currenttier] || "Brak Rangi";
    const wlString = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
    const dailyRRFormatted = totalRRChange >= 0 ? `+${totalRRChange}` : totalRRChange;

    let responseText = `${rankName} ${ranking_in_tier || 0}RR | Bilans: ${wlString} | Dzisiaj: ${dailyRRFormatted}RR`;
    if (lastMatchRR !== null && (wins > 0 || losses > 0 || draws > 0)) {
        responseText += ` | Last: ${lastMatchRR >= 0 ? '+' : ''}${lastMatchRR}RR`;
    }
    
    res.type('text/plain').send(responseText);
    logToDiscord({ title: 'API Call Success: `/daily`', color: 0x00FF00, fields: [{ name: 'Player', value: `\`${name}#${tag}\`` }, { name: 'Result', value: `\`${responseText}\`` }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
}));

router.get('/getrank/:position', asyncHandler(async (req, res, next) => {
    const { position } = req.params;
    const rankPosition = parseInt(position, 10);

    if (isNaN(rankPosition) || rankPosition <= 0) {
        return res.status(400).type('text/plain').send('Błąd: Podano nieprawidłową pozycję.');
    }
    if (rankPosition > 15000) {
        return res.type('text/plain').send(`Leaderboard VALORANT obsługuje tylko top 15000!`);
    }

    const player = findPlayerByRank(rankPosition);
    if (!player) {
        return res.status(404).type('text/plain').send(`Błąd: Ranga ${rankPosition} nie została znaleziona w tabeli wyników.`);
    }

    const isAnonymized = !player.gameName;
    const result = isAnonymized
        ? `Profil prywatny | Rating: ${player.rankedRating}RR | Wygrane: ${player.numberOfWins}`
        : `${player.gameName}#${player.tagLine} | Rating: ${player.rankedRating}RR | Wygrane: ${player.numberOfWins} | Tracker: https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.gameName)}%23${encodeURIComponent(player.tagLine)}/overview`;
    
    res.type('text/plain').send(result);
    logToDiscord({ title: 'API Call Success: `/getrank`', color: 0x00FF00, fields: [{ name: 'Position', value: `\`${rankPosition}\``, inline: true }, { name: 'Result', value: `\`${result}\``, inline: false }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
}));

router.get('/nextmatch/:event', asyncHandler(async (req, res, next) => {
    const { event } = req.params;
    const matches = await vlr.getUpcomingMatches();
    const nextMatch = matches.data.find(match => 
        match.event.name.toLowerCase() === event.toLowerCase()
    );
    if (!nextMatch) {
        const result = `Nie znaleziono nadchodzących meczy dla wydarzenia: "${event}". Sprawdź, czy nazwa jest poprawna.`;
        res.status(404).type('text/plain').send(result);
        logToDiscord({ 
            title: 'API Call Info: `/nextmatch` - Not Found', 
            color: 0xFFA500,
            fields: [{ name: 'Event Searched', value: `\`${event}\``, inline: true }], 
            timestamp: new Date().toISOString(), 
            footer: { text: `IP: ${req.ip}` } 
        });
        return;
    }

    const date = formatMatchDateTimeShort(nextMatch.date, nextMatch.time);
    const timeUntil = getTimeUntilMatch(nextMatch.date, nextMatch.time);

    const result = `Następny mecz na "${event}" to: ${nextMatch.teams[0].name} vs ${nextMatch.teams[1].name} za ${timeUntil} (${date})`;

    res.type('text/plain').send(result);
    logToDiscord({ title: 'API Call Success: `/nextmatch`', color: 0x00FF00, fields: [ { name: 'Event', value: `\`${event}\``, inline: true }, { name: 'Result', value: `\`${result}\``, inline: false } ], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });

}));

router.get('/dailymatches/:event', asyncHandler(async (req, res, next) => {
    const { event } = req.params;
    const matches = await vlr.getUpcomingMatches();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyMatches = matches.data.filter(match => {
        if (!match.event?.name || !match.date) {
            return false;
        }
        if (match.event.name.toLowerCase() !== event.toLowerCase()) {
            return false;
        }

        const matchDate = new Date(match.date);
        if (isNaN(matchDate.getTime())) {
            return false;
        }
        matchDate.setHours(0, 0, 0, 0);

        return matchDate.getTime() === today.getTime();
    });

    if (dailyMatches.length === 0) {
        const result = `Nie znaleziono na dzisiaj żadnych meczy dla wydarzenia: "${EVENTS[event]}".`;
        res.status(200).type('text/plain').send(result);
        logToDiscord({
            title: 'API Call Info: `/dailymatches` - Not Found',
            color: 0xFFA500,
            fields: [{ name: 'Event Searched', value: `\`${event}\``, inline: true }],
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${req.ip}` }
        });
        return;
    }

    dailyMatches.sort((a, b) => {
        const timeA = a.time?.replace(':', '') || '0';
        const timeB = b.time?.replace(':', '') || '0';
        return parseInt(timeA) - parseInt(timeB);
    });

    const matchesStrings = dailyMatches.map(match => {
        const time = formatMatchDateTimeShortHour(match.date, match.time) || 'brak godziny';
        const teamA = TEAMS[match.teams[0]?.name] || 'TBD';
        const teamB = TEAMS[match.teams[1]?.name] || 'TBD';
        return `${time} ${teamA} vs ${teamB}`;
    });

    const result = `Dzisiejsze mecze ${EVENTS[event]}: ${matchesStrings.join(' | ')}`;

    res.type('text/plain').send(result);
    logToDiscord({
        title: 'API Call Success: `/dailymatches`',
        color: 0x00FF00,
        fields: [
            { name: 'Event', value: `\`${event}\``, inline: true },
            { name: 'Result', value: `\`${result}\``, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `IP: ${req.ip}` }
    });
}));

module.exports = router;