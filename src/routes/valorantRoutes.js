const express = require('express');
const router = express.Router();
const { VALID_REGIONS, RANK_TIERS } = require('../constants');
const { logToDiscord } = require('../utils/discord');
const { getSessionTimeRange } = require('../utils/time');
const { fetchAccountDetails, fetchMatchHistory, fetchPlayerMMR, fetchLeaderboard, fetchMMRHistory, fetchMMRHistoryDaily } = require('../services/api');
const { findPlayerByRank } = require('../data/leaderboard');
const { calculateRRToGoal, calculateSessionStats } = require('../services/game');
const log = require('../utils/logger');

const asyncHandler = fn => (req, res, next) => {
    return Promise
        .resolve(fn(req, res, next))
        .catch(next);
};

router.get('/api/rank', asyncHandler(async (req, res, next) => {
    const { STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION } = require('../config');
    const encodedName = encodeURIComponent(STATS_PLAYER_NAME);
    const encodedTag = encodeURIComponent(STATS_PLAYER_TAG);
    const encodedRegion = encodeURIComponent(STATS_PLAYER_REGION);
    
    const mmrData = await fetchPlayerMMR(encodedRegion, encodedName, encodedTag);
    
    if (mmrData && mmrData.data) {
        res.json(mmrData.data);
    } else {
        res.status(404).json({ error: 'Nie znaleziono danych MMR.' });
    }
}));

router.get('/rank/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { text = "{rank} ({rr} RR) | {rrToGoal} RR do {goal}" } = req.query;

    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }

    const [mmr, leaderboard] = await Promise.all([
        fetchPlayerMMR(name, tag, region),
        fetchLeaderboard(region)
    ]);

    if (!mmr.data || !mmr.data.current_data) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza lub brak danych rankingowych.');
    }

    const { currenttier, ranking_in_tier } = mmr.data.current_data;
    const { rr, goal } = calculateRRToGoal(currenttier, ranking_in_tier || 0, leaderboard.data?.players);
    
    const finalText = text.replace(/{name}/g, name).replace(/{tag}/g, tag).replace(/{rank}/g, RANK_TIERS[currenttier] || "Unknown").replace(/{rr}/g, (ranking_in_tier || 0).toString()).replace(/{rrToGoal}/g, rr.toString()).replace(/{goal}/g, goal);
    
    res.type('text/plain').send(finalText);
    logToDiscord({ title: 'API Call Success: `/rank`', color: 0x00FF00, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Result', value: `\`${finalText}\``, inline: false }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
}));

router.get('/wl/:name/:tag/:region', asyncHandler(async (req, res, next) => {
    const { name, tag, region } = req.params;
    const { resetTime, sessionStart } = req.query;
    
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }
    
    const [account, history, mmrHistory] = await Promise.all([
        fetchAccountDetails(name, tag), 
        fetchMatchHistory(name, tag, region, 'competitive', 20),
        fetchMMRHistory(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
    }
    
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
    
    const [account, history, mmrHistory] = await Promise.all([ 
        fetchAccountDetails(name, tag), 
        fetchMatchHistory(name, tag, region, 'competitive', 25), 
        fetchMMRHistory(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
        return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
    }
    
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

    const [account, history, mmr, mmrHistory] = await Promise.all([
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
    if (rankPosition > 1000) {
        return res.type('text/plain').send(`Aktualnie !getrank obsługuje tylko top 1000!`);
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

module.exports = router;