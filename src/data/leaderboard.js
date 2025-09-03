const log = require('../utils/logger');

let leaderboardData = null;

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

initLeaderboard();

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

function getPlayersInRange(start, end) {
  if (!leaderboardData || !leaderboardData.data || !Array.isArray(leaderboardData.data.players)) {
    log.warn('LEADERBOARD', 'Leaderboard data not available');
    return [];
  }

  return leaderboardData.data.players
    .filter(p => p.leaderboardRank >= start && p.leaderboardRank <= end)
    .sort((a, b) => a.leaderboardRank - b.leaderboardRank);
}

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

function reloadLeaderboard() {
  log.info('LEADERBOARD', 'Reloading leaderboard data');
  initLeaderboard();
}

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