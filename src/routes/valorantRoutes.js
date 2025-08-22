const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { VALID_REGIONS, RANK_TIERS, TEAMS, EVENTS, RANK_ELO_THRESHOLDS } = require('../constants');
const { logToDiscord } = require('../utils/discord');
const { getSessionTimeRange, formatMatchDateTimeShort, getTimeUntilMatch, formatMatchDateTimeShortHour } = require('../utils/time');
const { 
  fetchAccountDetails, 
  fetchMatchHistory, 
  fetchPlayerMMR, 
  fetchLeaderboard, 
  fetchMMRHistory, 
  fetchMMRHistoryDaily,
  validatePlayerInput,
  APIError,
  getCacheStats,
  clearCache
} = require('../services/api');
const { findPlayerByRank } = require('../data/leaderboard');
const { calculateRRToGoal, calculateSessionStats } = require('../services/game');
const log = require('../utils/logger');

/**
 * Async handler wrapper for consistent error handling
 */
const asyncHandler = fn => (req, res, next) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(next);
};

/**
 * Standard API response formatter
 */
const standardResponse = (data, message = 'Success', status = 200) => {
  return {
    success: status < 400,
    message,
    data,
    timestamp: new Date().toISOString(),
    version: 'v1'
  };
};

/**
 * Calculate ELO to custom goal rank
 */
const calculateEloToCustomGoal = (currentElo, goalRank) => {
  const goalElo = RANK_ELO_THRESHOLDS[goalRank];
  if (goalElo === undefined) {
    return null; // Invalid rank name
  }
  
  const eloNeeded = goalElo - currentElo;
  return {
    eloNeeded: Math.max(0, eloNeeded), // Cannot be negative
    goalElo: goalElo,
    alreadyReached: eloNeeded <= 0
  };
};

/**
 * Deduplicate matches by match ID
 */
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

/**
 * Find player in leaderboard
 */
function findPlayer(leaderboard, name, tag) {
  let player = leaderboard.find(player => player.name === name && player.tag === tag);
  if (!player) return 'Not found';
  return player;
}

/**
 * @swagger
 * /api/rank:
 *   get:
 *     summary: Get configured player's rank information
 *     tags: [Rank]
 *     responses:
 *       200:
 *         description: Player rank information
 *       404:
 *         description: Player not found
 */
router.get('/api/rank', [
  query('format').optional().isIn(['json', 'text']).withMessage('Format must be json or text')
], asyncHandler(async (req, res, next) => {
  const { STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION } = require('../config');
  const { format = 'json' } = req.query;
  
  const mmrData = await fetchPlayerMMR(STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION);
  
  if (mmrData && mmrData.data) {
    if (format === 'text') {
      const { currenttier, ranking_in_tier } = mmrData.data.current_data;
      const rankName = RANK_TIERS[currenttier] || "Unknown";
      const rr = ranking_in_tier || 0;
      res.type('text/plain').send(`${rankName} ${rr}RR`);
    } else {
      res.json(standardResponse(mmrData.data));
    }
  } else {
    res.status(404).json(standardResponse(null, 'Player MMR data not found', 404));
  }
}));

/**
 * @swagger
 * /rank/{name}/{tag}/{region}:
 *   get:
 *     summary: Get player rank with customizable text format
 *     tags: [Rank]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Player name
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *         description: Player tag
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [na, eu, ap, kr, latam, br]
 *         description: Player region
 *       - in: query
 *         name: text
 *         schema:
 *           type: string
 *         description: Custom text format template
 *       - in: query
 *         name: goalRank
 *         schema:
 *           type: string
 *         description: Target rank for RR calculation
 *     responses:
 *       200:
 *         description: Formatted player rank information
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Player not found
 */
router.get('/rank/:name/:tag/:region', [
  param('name').trim().isLength({ min: 3, max: 16 }).withMessage('Name must be 3-16 characters'),
  param('tag').trim().isLength({ min: 3, max: 5 }).withMessage('Tag must be 3-5 characters'),
  param('region').isIn(VALID_REGIONS).withMessage('Invalid region'),
  query('text').optional().isString().withMessage('Text format must be a string'),
  query('goalRank').optional().isString().withMessage('Goal rank must be a string')
], asyncHandler(async (req, res, next) => {
  const { name, tag, region } = req.params;
  const { text = "{rank} {rr}RR | Daily: {wl} ({dailyRR}RR) | Last: {lastRR}RR", resetTime, goalRank } = req.query;

  // Validate input
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    return res.status(400).type('text/plain').send(`Error: ${validationError}`);
  }

  try {
    const [mmr, account, rawHistory, mmrHistory] = await Promise.all([
      fetchPlayerMMR(name, tag, region),
      fetchAccountDetails(name, tag),
      fetchMatchHistory(name, tag, region, 'competitive', 25),
      fetchMMRHistoryDaily(name, tag, region)
    ]);

    let lastStatsRaw;
    if (rawHistory.data && rawHistory.data[0] && rawHistory.data[0].players) {
      rawHistory.data[0].players.forEach(player => {
        if (player.name == name) lastStatsRaw = player;
      });
    }

    if (!mmr.data || !mmr.data.current_data) {
      return res.status(404).type('text/plain').send('Error: Player not found or no ranking data available.');
    }
    if (!account.data?.puuid) {
      return res.status(404).type('text/plain').send('Error: Player account not found for daily statistics.');
    }

    const history = deduplicateMatches(rawHistory);
    const { currenttier, ranking_in_tier, elo } = mmr.data.current_data;
    
    let rr, goal, rrToGoal;
    
    if (goalRank) {
      const customGoal = calculateEloToCustomGoal(elo, goalRank);
      if (customGoal === null) {
        return res.status(400).type('text/plain').send(`Error: Invalid rank name "${goalRank}". Available ranks: ${Object.keys(RANK_ELO_THRESHOLDS).join(', ')}`);
      }
      
      rrToGoal = customGoal.eloNeeded;
      goal = goalRank;
      rr = rrToGoal;
      
      if (customGoal.alreadyReached) {
        goal = `${goalRank} (already achieved!)`;
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

    let finalText = text
      .replace(/{name}/g, name)
      .replace(/{tag}/g, tag)
      .replace(/{rank}/g, RANK_TIERS[currenttier] || "Unknown")
      .replace(/{rr}/g, (ranking_in_tier || 0).toString())
      .replace(/{rrToGoal}/g, rrToGoal.toString())
      .replace(/{goal}/g, goal)
      .replace(/{wl}/g, wlString)
      .replace(/{dailyRR}/g, dailyRRFormatted)
      .replace(/{lastRR}/g, lastRRFormatted);

    // Handle last match stats if available
    if (lastStatsRaw && lastStatsRaw.stats) {
      const lastStats = `${lastStatsRaw.stats.kills}/${lastStatsRaw.stats.deaths}/${lastStatsRaw.stats.assists}`;
      const lastAgent = lastStatsRaw.agent?.name || 'Unknown';
      finalText = finalText
        .replace(/{lastStats}/g, lastStats)
        .replace(/{lastAgent}/g, lastAgent);
    } else {
      finalText = finalText
        .replace(/{lastStats}/g, '-')
        .replace(/{lastAgent}/g, '-');
    }

    const isRadiant = currenttier === 27;
    if (isRadiant && !goalRank) {
      finalText = finalText.replace(/{rrToGoal}RR do {goal}/g, "Congratulations on Radiant!");
    }
    
    if (goalRank && rrToGoal === 0) {
      finalText = finalText.replace(/{rrToGoal}RR do {goal}/g, `Goal "${goalRank}" already achieved!`);
    }
    
    res.type('text/plain').send(finalText);
    
    logToDiscord({ 
      title: 'API Call Success: `/rank` (extended)', 
      color: 0x00FF00, 
      fields: [
        { name: 'Player', value: `\`${name}#${tag}\``, inline: true }, 
        { name: 'Custom Goal', value: goalRank ? `\`${goalRank}\`` : 'Default (next rank)', inline: true },
        { name: 'Result', value: `\`${finalText.substring(0, 200)}${finalText.length > 200 ? '...' : ''}\``, inline: false }
      ], 
      timestamp: new Date().toISOString(), 
      footer: { text: `IP: ${req.ip}` } 
    });
  } catch (error) {
    log.error('RANK_ENDPOINT', `Error processing rank request for ${name}#${tag}`, error);
    res.status(500).type('text/plain').send('Error: Internal server error occurred.');
  }
}));

function isValidPlayerName(name) {
  // Decode URL-encoded characters (like %20 for space)
  const decodedName = decodeURIComponent(name);
  return /^[\p{L}\p{N}_\-\s\.]{3,16}$/u.test(decodedName);
}

/**
 * @swagger
 * /wl/{name}/{tag}/{region}:
 *   get:
 *     summary: Get player win/loss statistics for current session
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [na, eu, ap, kr, latam, br]
 *     responses:
 *       200:
 *         description: Win/loss statistics
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Player not found
 */
router.get('/wl/:name/:tag/:region', [
  param('name').custom(value => {
    if (!isValidPlayerName(value)) {
      throw new Error('Name must be 3-16 characters and contain only letters, numbers, spaces, underscores, hyphens, and dots');
    }
    return true;
  }),
  param('tag').custom(value => {
    if (!isValidPlayerTag(value)) {
      throw new Error('Tag must be 3-5 characters and contain only letters and numbers');
    }
    return true;
  }),
  param('region').isIn(VALID_REGIONS).withMessage('Invalid region')
], asyncHandler(async (req, res, next) => {
  const { name, tag, region } = req.params;
  const { resetTime, sessionStart } = req.query;
  
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    return res.status(400).type('text/plain').send(`Error: ${validationError}`);
  }
  
  try {
    const [account, rawHistory, mmrHistory] = await Promise.all([
      fetchAccountDetails(name, tag), 
      fetchMatchHistory(name, tag, region, 'competitive', 20),
      fetchMMRHistory(name, tag, region)
    ]);
    
    if (!account.data?.puuid) {
      return res.status(404).type('text/plain').send('Error: Player not found.');
    }
    
    const history = deduplicateMatches(rawHistory);
    
    const mmrHistoryArray = mmrHistory?.data || [];
    const { startTime, endTime } = getSessionTimeRange(sessionStart ? parseInt(sessionStart, 10) * 1000 : null, resetTime);
    const { wins, losses, draws } = calculateSessionStats(history, mmrHistoryArray, account.data.puuid, startTime, endTime);
    
    const result = draws > 0 ? `${wins}W/${draws}D/${losses}L` : `${wins}W/${losses}L`;
    res.type('text/plain').send(result);
    
    logToDiscord({ 
      title: 'API Call Success: `/wl`', 
      color: 0x00FF00, 
      fields: [
        { name: 'Player', value: `\`${name}#${tag}\``, inline: true }, 
        { name: 'Result', value: `\`${result}\``, inline: false }
      ], 
      timestamp: new Date().toISOString(), 
      footer: { text: `IP: ${req.ip}` } 
    });
  } catch (error) {
    log.error('WL_ENDPOINT', `Error processing WL request for ${name}#${tag}`, error);
    res.status(500).type('text/plain').send('Error: Internal server error occurred.');
  }
}));

/**
 * @swagger
 * /getrank/{position}:
 *   get:
 *     summary: Get player information by leaderboard position
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: path
 *         name: position
 *         required: true
 *         schema:
 *           type: integer
 *         description: Leaderboard position (1-15000)
 *     responses:
 *       200:
 *         description: Player information
 *       400:
 *         description: Invalid position
 *       404:
 *         description: Position not found
 */
router.get('/getrank/:position', [
  param('position').isInt({ min: 1, max: 15000 }).withMessage('Position must be between 1 and 15000')
], asyncHandler(async (req, res, next) => {
  const { position } = req.params;
  const rankPosition = parseInt(position, 10);

  try {
    const player = findPlayerByRank(rankPosition);
    if (!player) {
      return res.status(404).type('text/plain').send(`Error: Rank ${rankPosition} not found in leaderboard.`);
    }

    const isAnonymized = !player.gameName;
    const result = isAnonymized
      ? `Private profile | Rating: ${player.rankedRating}RR | Wins: ${player.numberOfWins}`
      : `${player.gameName}#${player.tagLine} | Rating: ${player.rankedRating}RR | Wins: ${player.numberOfWins} | Tracker: https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.gameName)}%23${encodeURIComponent(player.tagLine)}/overview`;
    
    res.type('text/plain').send(result);
    
    logToDiscord({ 
      title: 'API Call Success: `/getrank`', 
      color: 0x00FF00, 
      fields: [
        { name: 'Position', value: `\`${rankPosition}\``, inline: true }, 
        { name: 'Result', value: `\`${result.substring(0, 200)}${result.length > 200 ? '...' : ''}\``, inline: false }
      ], 
      timestamp: new Date().toISOString(), 
      footer: { text: `IP: ${req.ip}` } 
    });
  } catch (error) {
    log.error('GETRANK_ENDPOINT', `Error processing getrank request for position ${rankPosition}`, error);
    res.status(500).type('text/plain').send('Error: Internal server error occurred.');
  }
}));

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Cache statistics
 */
router.get('/api/cache/stats', asyncHandler(async (req, res) => {
  const stats = getCacheStats();
  res.json(standardResponse(stats));
}));

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     summary: Clear cache
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/api/cache/clear', asyncHandler(async (req, res) => {
  clearCache();
  res.json(standardResponse(null, 'Cache cleared successfully'));
}));

module.exports = router;