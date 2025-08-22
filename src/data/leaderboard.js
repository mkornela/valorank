const log = require('../utils/logger');

/**
 * Load leaderboard data from JSON file
 */
let leaderboardData = null;

/**
 * Initialize leaderboard data
 */
function initLeaderboard() {
  try {
    const fs = require('fs');
    const path = require('path');

    const leaderboardPath = path.join(process.cwd(), 'src/data/leaderboard.json');

    if (fs.existsSync(leaderboardPath)) {
      const rawData = fs.readFileSync(leaderboardPath, 'utf8');
      leaderboardData = JSON.parse(rawData);
      log.info('LEADERBOARD', `Loaded ${leaderboardData.data?.players?.length || 0} players from leaderboard`);
    } else {
      log.warn('LEADERBOARD', 'Leaderboard file not found. Please create src/data/leaderboard.json');
      leaderboardData = { data: { players: [] } };
    }
  } catch (error) {
    log.error('LEADERBOARD', 'Failed to load leaderboard data', error);
    leaderboardData = { data: { players: [] } };
  }
}

// Initialize on module load
initLeaderboard();

/**
 * Find player by rank position
 * @param {number} position - Leaderboard position
 * @returns {Object|null} Player data or null if not found
 */
function findPlayerByRank(position) {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    log.warn('LEADERBOARD', 'Leaderboard data not available');
    return null;
  }

  const player = leaderboardData.data.players.find(p => p.leaderboardRank === position);

  if (!player) {
    log.debug('LEADERBOARD', `Player not found at position ${position}`);
    return null;
  }

  return player;
}

/**
 * Find player by name and tag
 * @param {string} name - Player name
 * @param {string} tag - Player tag
 * @returns {Object|null} Player data or null if not found
 */
function findPlayerByNameTag(name, tag) {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    log.warn('LEADERBOARD', 'Leaderboard data not available');
    return null;
  }

  const player = leaderboardData.data.players.find(p =>
    p.gameName === name && p.tagLine === tag
  );

  if (!player) {
    log.debug('LEADERBOARD', `Player not found: ${name}#${tag}`);
    return null;
  }

  return player;
}

/**
 * Get players in rank range
 * @param {number} start - Starting rank
 * @param {number} end - Ending rank
 * @returns {Array} Array of players in range
 */
function getPlayersInRange(start, end) {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    log.warn('LEADERBOARD', 'Leaderboard data not available');
    return [];
  }

  return leaderboardData.data.players
    .filter(p => p.leaderboardRank >= start && p.leaderboardRank <= end)
    .sort((a, b) => a.leaderboardRank - b.leaderboardRank);
}

/**
 * Get leaderboard statistics
 * @returns {Object} Statistics about the leaderboard
 */
function getLeaderboardStats() {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    return {
      totalPlayers: 0,
      averageRR: 0,
      maxRR: 0,
      minRR: 0,
      regionDistribution: {}
    };
  }

  const players = leaderboardData.data.players;
  const totalPlayers = players.length;

  if (totalPlayers === 0) {
    return {
      totalPlayers: 0,
      averageRR: 0,
      maxRR: 0,
      minRR: 0,
      regionDistribution: {}
    };
  }

  const rrValues = players.map(p => p.rankedRating || 0);
  const averageRR = rrValues.reduce((sum, rr) => sum + rr, 0) / totalPlayers;
  const maxRR = Math.max(...rrValues);
  const minRR = Math.min(...rrValues);

  // Region distribution (if available)
  const regionDistribution = players.reduce((acc, p) => {
    const region = p.region || 'unknown';
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {});

  return {
    totalPlayers,
    averageRR: Math.round(averageRR),
    maxRR,
    minRR,
    regionDistribution
  };
}

/**
 * Reload leaderboard data from file
 */
function reloadLeaderboard() {
  log.info('LEADERBOARD', 'Reloading leaderboard data');
  initLeaderboard();
}

/**
 * Search players by name (partial match)
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum results
 * @returns {Array} Array of matching players
 */
function searchPlayers(searchTerm, limit = 10) {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    return [];
  }

  const term = searchTerm.toLowerCase();
  const matches = leaderboardData.data.players
    .filter(p =>
      (p.gameName && p.gameName.toLowerCase().includes(term)) ||
      (p.tagLine && p.tagLine.toLowerCase().includes(term))
    )
    .slice(0, limit);

  return matches;
}

module.exports = {
  findPlayerByRank,
  findPlayerByNameTag,
  getPlayersInRange,
  getLeaderboardStats,
  reloadLeaderboard,
  searchPlayers
};