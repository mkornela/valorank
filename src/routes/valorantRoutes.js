const express = require('express');
const router = express.Router();

const config = require('../config');
const { VALID_REGIONS, RANK_TIERS } = require('../constants');
const { logToDiscord } = require('../utils/discord');
const { getSessionTimeRange } = require('../utils/time');
const { fetchFromHenrikApi, fetchAccountDetails, fetchMatchHistory, fetchPlayerMMR, fetchLeaderboard, fetchMMRHistory } = require('../services/api');
const { findPlayerByRank } = require('../data/leaderboard');
const { calculateRRToGoal, calculateSessionStats } = require('../services/game');
const log = require('../utils/logger');

router.get('/api/rank', async (req, res) => {
    try {
        const encodedName = encodeURIComponent(config.STATS_PLAYER_NAME);
        const encodedTag = encodeURIComponent(config.STATS_PLAYER_TAG);
        const encodedRegion = encodeURIComponent(config.STATS_PLAYER_REGION);
        
        const mmrData = await fetchFromHenrikApi(`/valorant/v3/mmr/${encodedRegion}/pc/${encodedName}/${encodedTag}`);
        
        if (mmrData && mmrData.data) {
            res.json(mmrData.data);
        } else {
            res.status(404).json({ error: 'Nie znaleziono danych MMR.' });
        }
    } catch (error) {
        log.error('ROUTES', `/api/rank Error: ${error.message}`);
        res.status(500).json({ error: 'Błąd serwera podczas pobierania danych o randze.' });
    }
});

router.get('/rank/:name/:tag/:region', async (req, res) => {
    const { name, tag, region } = req.params;
    const { text = "{rank} ({rr} RR) | {rrToGoal} RR do {goal}" } = req.query;

    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        logToDiscord({ title: 'API Call Failed: `/rank`', color: 0xFFA500, description: 'Invalid region provided.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Provided Region', value: `\`${region}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
        return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
    }

    try {
        const [mmr, leaderboard] = await Promise.all([
            fetchPlayerMMR(name, tag, region),
            fetchLeaderboard(region)
        ]);

        if (!mmr.data || !mmr.data.current_data) {
            logToDiscord({ title: 'API Call Failed: `/rank`', color: 0xFFA500, description: 'Player not found or has no ranked data.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
            return res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza lub brak danych rankingowych.');
        }

        const { currenttier, ranking_in_tier } = mmr.data.current_data;
        const { rr, goal } = calculateRRToGoal(currenttier, ranking_in_tier || 0, leaderboard.data?.players);
        
        const finalText = text.replace(/{name}/g, name).replace(/{tag}/g, tag).replace(/{rank}/g, RANK_TIERS[currenttier] || "Unknown").replace(/{rr}/g, (ranking_in_tier || 0).toString()).replace(/{rrToGoal}/g, rr.toString()).replace(/{goal}/g, goal);
        
        res.type('text/plain').send(finalText);
        logToDiscord({ title: 'API Call Success: `/rank`', color: 0x00FF00, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }, { name: 'Result', value: `\`${finalText}\``, inline: false }, { name: 'Template', value: `\`${text}\``, inline: false }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });

    } catch (error) {
        log.error('ROUTES', `Error in /rank endpoint: ${error.message}`);
        res.status(500).type('text/plain').send('Błąd: API jest niedostępne.');
        logToDiscord({ title: 'API Error: `/rank`', color: 0xFF0000, description: `\`\`\`${error.message}\`\`\``, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
});

router.get('/wl/:name/:tag/:region', async (req, res) => {
    const { name, tag, region } = req.params;
    const { resetTime, sessionStart } = req.query;
    
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
        return logToDiscord({ title: 'API Call Failed: `/wl`', color: 0xFFA500, description: 'Invalid region provided.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Provided Region', value: `\`${region}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
    
    try {
        const [account, history] = await Promise.all([
            fetchAccountDetails(name, tag), 
            fetchMatchHistory(name, tag, region, 'competitive', 20)
        ]);
        
        if (!account.data || !account.data.puuid) {
            res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
            return logToDiscord({ title: 'API Call Failed: `/wl`', color: 0xFFA500, description: 'Player not found.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
        }
        
        let wins = 0, losses = 0, draws = 0;
        
        if (sessionStart) {
            const sessionStartTimestamp = parseInt(sessionStart, 10);
            if (isNaN(sessionStartTimestamp) || sessionStartTimestamp <= 0) {
                return res.status(400).type('text/plain').send('Błąd: Nieprawidłowy format czasu rozpoczęcia sesji (musi być w sekundach unix).');
            }
            const { wins: sWins, losses: sLosses, draws: sDraws } = calculateSessionStats(history, account.data.puuid, new Date(sessionStartTimestamp * 1000), new Date());
            wins = sWins; losses = sLosses; draws = sDraws;
        } else {
            const { startTime, endTime } = getSessionTimeRange(req.query.since ? parseInt(req.query.since, 10) : null, resetTime);
            const { wins: sWins, losses: sLosses, draws: sDraws } = calculateSessionStats(history, account.data.puuid, startTime, endTime);
            wins = sWins; losses = sLosses; draws = sDraws;
        }
        
        const result = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
        res.type('text/plain').send(result);
        
        const logFields = [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }, { name: 'Result', value: `\`${result}\``, inline: false }];
        if (resetTime) logFields.push({ name: 'Reset Time', value: `\`${resetTime}\``, inline: true });
        if (sessionStart) logFields.push({ name: 'Session Start', value: `\`${new Date(parseInt(sessionStart) * 1000).toISOString()}\``, inline: true });
        logToDiscord({ title: 'API Call Success: `/wl`', color: 0x00FF00, fields: logFields, timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });
        
    } catch (error) {
        log.error('ROUTES', `Error in /wl endpoint: ${error.message}`);
        const errorMessage = error.message.includes('Invalid resetTime') ? 'Błąd: ' + error.message : 'Błąd: API jest niedostępne.';
        res.status(500).type('text/plain').send(errorMessage);
        logToDiscord({ title: 'API Error: `/wl`', color: 0xFF0000, description: `\`\`\`${error.message}\`\`\``, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
});

router.get('/advanced_wl/:name/:tag/:region', async (req, res) => {
    const { name, tag, region } = req.params;
    const { resetTime } = req.query;
    
    if (!VALID_REGIONS.includes(region.toLowerCase())) {
        res.status(400).type('text/plain').send('Błąd: Nieprawidłowy region.');
        return logToDiscord({ title: 'API Call Failed: `/advanced_wl`', color: 0xFFA500, description: 'Invalid region provided.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Provided Region', value: `\`${region}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
    
    try {
        const [account, history, mmrHistory] = await Promise.all([ fetchAccountDetails(name, tag), fetchMatchHistory(name, tag, region, 'competitive', 25), fetchMMRHistory(name, tag, region) ]);
        
        if (!account.data || !account.data.puuid) {
            res.status(404).type('text/plain').send('Błąd: Nie znaleziono gracza.');
            return logToDiscord({ title: 'API Call Failed: `/advanced_wl`', color: 0xFFA500, description: 'Player not found.', fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
        }
        
        const { startTime, endTime } = getSessionTimeRange(req.query.since ? parseInt(req.query.since, 10) : null, resetTime);
        let { wins, losses, draws, lastMatchResult, lastMatchRR } = calculateSessionStats(history, account.data.puuid, startTime, endTime);
        
        if (lastMatchRR === null && mmrHistory.data && mmrHistory.data.length > 0) {
            const latestMMR = mmrHistory.data[0];
            if (latestMMR.mmr_change_to_last_game !== undefined) {
                lastMatchRR = latestMMR.mmr_change_to_last_game;
            }
        }
        
        let result = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
        if (lastMatchResult) {
            result += ` (Last:`; //${lastMatchResult} removed
            if (lastMatchRR != null) { result += ` ${lastMatchRR >= 0 ? '+' : ''}${lastMatchRR}RR`; }
            result += ')';
        }
        res.type('text/plain').send(result);

        const logFields = [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }, { name: 'Result', value: `\`${result}\``, inline: false }];
        if (resetTime) logFields.push({ name: 'Reset Time', value: `\`${resetTime}\``, inline: true });
        logToDiscord({ title: 'API Call Success: `/advanced_wl`', color: 0x00FF00, fields: logFields, timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });

    } catch (error) {
        log.error('ROUTES', `Error in /advanced_wl endpoint: ${error.message}`);
        const errorMessage = error.message.includes('Invalid resetTime') ? 'Błąd: ' + error.message : 'Błąd: API jest niedostępne.';
        res.status(500).type('text/plain').send(errorMessage);
        logToDiscord({ title: 'API Error: `/advanced_wl`', color: 0xFF0000, description: `\`\`\`${error.message}\`\`\``, fields: [{ name: 'Player', value: `\`${name}#${tag}\``, inline: true }, { name: 'Region', value: region.toUpperCase(), inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
});

router.get('/getrank/:position', async (req, res) => {
    const { position } = req.params;
    const rankPosition = parseInt(position, 10);

    if (isNaN(rankPosition) || rankPosition <= 0) {
        res.status(400).type('text/plain').send('Błąd: Podano nieprawidłową pozycję.');
        return logToDiscord({ title: 'API Call Failed: `/getrank`', color: 0xFFA500, description: 'Invalid position provided.', fields: [{ name: 'Provided Position', value: `\`${position}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }

    try {
        const player = findPlayerByRank(rankPosition);
        
        if (rankPosition > 1000) {
            return res.type('text/plain').send(`Aktualnie !getrank obsługuje tylko top 1000!`);
        }
        
        if (!player) {
            res.status(404).type('text/plain').send(`Błąd: Ranga ${rankPosition} nie została znaleziona w tabeli wyników.`);
            return logToDiscord({ title: 'API Call Failed: `/getrank`', color: 0xFFA500, description: `Rank ${rankPosition} not found on leaderboard.`, fields: [{ name: 'Position', value: `\`${rankPosition}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
        }

        const isAnonymized = !player.gameName;
        let result;
        if (isAnonymized) {
            result = `Profil prywatny | Rating: ${player.rankedRating}RR | Wygrane: ${player.numberOfWins}`;
        } else {
            result = `${player.gameName}#${player.tagLine} | Rating: ${player.rankedRating}RR | Wygrane: ${player.numberOfWins} | Tracker: https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.gameName)}%23${encodeURIComponent(player.tagLine)}/overview`;
        }
        
        res.type('text/plain').send(result);
        logToDiscord({ title: 'API Call Success: `/getrank`', color: 0x00FF00, fields: [{ name: 'Position', value: `\`${rankPosition}\``, inline: true }, { name: 'Result', value: `\`${result}\``, inline: false }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } });

    } catch (error) {
        log.error('ROUTES', `Error in /getrank endpoint: ${error.message}`);
        res.status(500).type('text/plain').send('Błąd: API jest niedostępne lub wystąpił błąd.');
        logToDiscord({ title: 'API Error: `/getrank`', color: 0xFF0000, description: `\`\`\`${error.message}\`\`\``, fields: [{ name: 'Position', value: `\`${rankPosition}\``, inline: true }], timestamp: new Date().toISOString(), footer: { text: `IP: ${req.ip}` } }, true);
    }
});

module.exports = router;