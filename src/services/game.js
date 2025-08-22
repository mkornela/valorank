const { RANK_TIERS, RADIANT_BASE_THRESHOLD } = require('../constants');
const log = require('../utils/logger');

/**
 * Calculate RR needed to reach next rank
 * @param {number} currentTier - Current tier ID
 * @param {number} currentRR - Current RR in tier
 * @returns {Object} Object containing RR needed and goal rank
 */
function calculateRRToGoal(currentTier, currentRR) {
    // Handle unranked players
    if (currentTier === 0) {
        return {
            rr: 100, // RR needed for Iron 1
            goal: 'Iron 1'
        };
    }

    // Handle Radiant players
    if (currentTier === 27) {
        return {
            rr: 0,
            goal: 'Radiant (Max!)'
        };
    }

    // Calculate RR needed for next tier
    const nextTier = currentTier + 1;
    const rrNeeded = 100 - currentRR;
    const goalRank = RANK_TIERS[nextTier];

    return {
        rr: Math.max(0, rrNeeded),
        goal: goalRank
    };
}

/**
 * Calculate session statistics from match history
 * @param {Object} matchHistory - Match history data
 * @param {Array} mmrHistory - MMR history data
 * @param {string} playerPUUID - Player's PUUID
 * @param {Date} startTime - Session start time
 * @param {Date} endTime - Session end time
 * @returns {Object} Session statistics
 */
function calculateSessionStats(matchHistory, mmrHistory, playerPUUID, startTime, endTime) {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let lastMatchRR = null;
    let totalRRChange = 0;
    let lastMatchResult = null;
    let lastMatchTime = null;

    // Process match history
    if (matchHistory && matchHistory.data && Array.isArray(matchHistory.data)) {
        let debugCount = 0;
        for (const match of matchHistory.data) {
            // Log structure of first few matches for debugging
            if (debugCount < 3) {
                log.debug('SESSION_STATS', `Match ${debugCount + 1} structure:`, {
                    matchId: match.metadata?.matchid,
                    hasTeams: !!match.teams,
                    teamsType: Array.isArray(match.teams) ? 'array' : typeof match.teams,
                    hasRounds: !!match.rounds,
                    roundsType: Array.isArray(match.rounds) ? 'array' : typeof match.rounds,
                    playersType: Array.isArray(match.players) ? 'array' : typeof match.players,
                    all_playersType: Array.isArray(match.players?.all_players) ? 'array' : typeof match.players?.all_players
                });
                debugCount++;
            }

            const matchTime = new Date(match.metadata?.game_start_iso || match.meta?.start_time);

            // Skip matches outside session time range
            if (matchTime < startTime || matchTime > endTime) {
                continue;
            }

            // Find player in the match
            const player = match.players?.all_players?.find(p => p.puuid === playerPUUID) ||
                match.players?.find(p => p.puuid === playerPUUID);

            if (!player) {
                log.debug('SESSION_STATS', `Player ${playerPUUID} not found in match ${match.metadata?.matchid}`);
                continue;
            }

            // Determine match result - handle different possible data structures
            let hasWon = undefined;

            // Try different possible structures for match result
            if (match.teams && Array.isArray(match.teams)) {
                const team = match.teams.find(t => t.team_id === player.team_id);
                hasWon = team?.has_won;
                log.debug('SESSION_STATS', `Team structure found for match ${match.metadata?.matchid}:`, {
                    playerTeamId: player.team_id,
                    foundTeam: !!team,
                    hasWon: hasWon
                });
            } else if (match.rounds && Array.isArray(match.rounds)) {
                // Some API responses use rounds structure
                const playerTeamRounds = match.rounds.filter(round =>
                    round.teams && round.teams.find(t => t.team_id === player.team_id)
                );
                const wonRounds = playerTeamRounds.filter(round => {
                    const team = round.teams.find(t => t.team_id === player.team_id);
                    return team && team.won;
                });
                hasWon = wonRounds.length > playerTeamRounds.length / 2;
                log.debug('SESSION_STATS', `Rounds structure found for match ${match.metadata?.matchid}:`, {
                    totalRounds: playerTeamRounds.length,
                    wonRounds: wonRounds.length,
                    hasWon: hasWon
                });
            }

            // Additional check: look for blue/red team structure (common in Valorant APIs)
            if (hasWon === undefined && match.teams) {
                const blueTeam = match.teams.find(t => t.team_id === 'Blue' || t.team_id === 'blue');
                const redTeam = match.teams.find(t => t.team_id === 'Red' || t.team_id === 'red');

                if (blueTeam && redTeam) {
                    // Check if player is on blue team
                    if (player.team_id === 'Blue' || player.team_id === 'blue') {
                        hasWon = blueTeam.has_won;
                        matchDebugInfo.blueRedTeam = 'blue';
                        matchDebugInfo.method = 'blue_red';
                    } else if (player.team_id === 'Red' || player.team_id === 'red') {
                        hasWon = redTeam.has_won;
                        matchDebugInfo.blueRedTeam = 'red';
                        matchDebugInfo.method = 'blue_red';
                    }
                }
            }

            if (hasWon === true) {
                wins++;
                lastMatchResult = 'win';
            } else if (hasWon === false) {
                losses++;
                lastMatchResult = 'loss';
            } else {
                // Check for actual draw conditions (very rare in Valorant)
                if (match.teams && Array.isArray(match.teams) && match.teams.length >= 2) {
                    const team1 = match.teams[0];
                    const team2 = match.teams[1];
                    if (team1.rounds_won !== undefined && team2.rounds_won !== undefined) {
                        if (team1.rounds_won === team2.rounds_won) {
                            // This is a legitimate draw/tie
                            draws++;
                            lastMatchResult = 'draw';
                            log.debug('SESSION_STATS', `Legitimate draw detected in match ${match.metadata?.matchid}`);
                        } else {
                            // Can't determine result, skip this match
                            log.debug('SESSION_STATS', `Could not determine match result for ${playerPUUID} in match ${match.metadata?.matchid} - no clear win/loss data`, matchDebugInfo);
                            continue;
                        }
                    } else {
                        // Can't determine result, skip this match
                        log.debug('SESSION_STATS', `Could not determine match result for ${playerPUUID} in match ${match.metadata?.matchid} - no score data`, matchDebugInfo);
                        continue;
                    }
                } else {
                    // Can't determine result, skip this match
                    log.debug('SESSION_STATS', `Could not determine match result for ${playerPUUID} in match ${match.metadata?.matchid} - no teams data`, matchDebugInfo);
                    continue;
                }
            }

            lastMatchTime = matchTime;
        }
    }

    // Process MMR history for RR changes
    if (mmrHistory && Array.isArray(mmrHistory)) {
        const sessionMMR = mmrHistory.filter(entry => {
            const entryTime = new Date(entry.date || entry.timestamp);
            return entryTime >= startTime && entryTime <= endTime;
        });

        if (sessionMMR.length >= 2) {
            const firstMMR = sessionMMR[0];
            const lastMMR = sessionMMR[sessionMMR.length - 1];

            totalRRChange = (lastMMR.ranking_in_tier || 0) - (firstMMR.ranking_in_tier || 0);

            // Calculate last match RR change
            if (sessionMMR.length > 1) {
                const secondLastMMR = sessionMMR[sessionMMR.length - 2];
                lastMatchRR = (lastMMR.ranking_in_tier || 0) - (secondLastMMR.ranking_in_tier || 0);
            }
        } else if (sessionMMR.length === 1) {
            // Only one MMR entry in session
            totalRRChange = 0;
            lastMatchRR = null;
        }
    }

    return {
        wins,
        losses,
        draws,
        lastMatchRR,
        totalRRChange,
        lastMatchResult,
        lastMatchTime
    };
}

/**
 * Calculate win rate
 * @param {number} wins - Number of wins
 * @param {number} losses - Number of losses
 * @param {number} draws - Number of draws (optional)
 * @returns {number} Win rate percentage
 */
function calculateWinRate(wins, losses, draws = 0) {
    const totalMatches = wins + losses + draws;
    if (totalMatches === 0) return 0;

    return Math.round((wins / totalMatches) * 100);
}

/**
 * Calculate performance metrics
 * @param {Object} matchHistory - Match history data
 * @param {string} playerPUUID - Player's PUUID
 * @returns {Object} Performance metrics
 */
function calculatePerformanceMetrics(matchHistory, playerPUUID) {
    if (!matchHistory || !matchHistory.data || !Array.isArray(matchHistory.data)) {
        return {
            totalKills: 0,
            totalDeaths: 0,
            totalAssists: 0,
            averageKDA: 0,
            headshotPercentage: 0,
            averageDamage: 0,
            averageScore: 0
        };
    }

    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalHeadshots = 0;
    let totalBodyShots = 0;
    let totalLegShots = 0;
    let totalDamage = 0;
    let totalScore = 0;
    let validMatches = 0;

    for (const match of matchHistory.data) {
        const player = match.players?.all_players?.find(p => p.puuid === playerPUUID) ||
            match.players?.find(p => p.puuid === playerPUUID);

        if (!player || !player.stats) continue;

        const stats = player.stats;
        totalKills += stats.kills || 0;
        totalDeaths += stats.deaths || 0;
        totalAssists += stats.assists || 0;
        totalHeadshots += stats.headshots || 0;
        totalBodyShots += stats.bodyshots || 0;
        totalLegShots += stats.legshots || 0;
        totalDamage += stats.damage || 0;
        totalScore += stats.score || 0;
        validMatches++;
    }

    if (validMatches === 0) {
        return {
            totalKills: 0,
            totalDeaths: 0,
            totalAssists: 0,
            averageKDA: 0,
            headshotPercentage: 0,
            averageDamage: 0,
            averageScore: 0
        };
    }

    const totalShots = totalHeadshots + totalBodyShots + totalLegShots;
    const headshotPercentage = totalShots > 0 ? (totalHeadshots / totalShots) * 100 : 0;
    const averageKDA = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : totalKills + totalAssists;

    return {
        totalKills,
        totalDeaths,
        totalAssists,
        averageKDA: Math.round(averageKDA * 100) / 100,
        headshotPercentage: Math.round(headshotPercentage * 100) / 100,
        averageDamage: Math.round(totalDamage / validMatches),
        averageScore: Math.round(totalScore / validMatches),
        matchesAnalyzed: validMatches
    };
}

/**
 * Get rank progression data
 * @param {Array} mmrHistory - MMR history data
 * @returns {Object} Rank progression data
 */
function getRankProgression(mmrHistory) {
    if (!mmrHistory || !Array.isArray(mmrHistory)) {
        return {
            progression: [],
            currentStreak: 0,
            bestStreak: 0,
            rankChanges: 0
        };
    }

    const progression = [];
    let currentStreak = 0;
    let bestStreak = 0;
    let rankChanges = 0;
    let lastTier = null;

    for (const entry of mmrHistory) {
        const tier = entry.currenttier || 0;
        const rr = entry.ranking_in_tier || 0;
        const rankName = RANK_TIERS[tier] || 'Unknown';

        progression.push({
            date: entry.date || entry.timestamp,
            tier,
            rr,
            rankName,
            timestamp: new Date(entry.date || entry.timestamp).getTime()
        });

        // Track rank changes
        if (lastTier !== null && tier !== lastTier) {
            rankChanges++;

            // Update streak
            if (tier > lastTier) {
                currentStreak++;
                bestStreak = Math.max(bestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        lastTier = tier;
    }

    return {
        progression,
        currentStreak,
        bestStreak,
        rankChanges
    };
}

/**
 * Calculate session summary
 * @param {Object} sessionStats - Session statistics
 * @param {Object} performanceMetrics - Performance metrics
 * @returns {Object} Session summary
 */
function calculateSessionSummary(sessionStats, performanceMetrics) {
    const { wins, losses, draws } = sessionStats;
    const totalMatches = wins + losses + draws;
    const winRate = calculateWinRate(wins, losses, draws);

    return {
        totalMatches,
        wins,
        losses,
        draws,
        winRate,
        kdRatio: performanceMetrics.averageKDA,
        headshotPercentage: performanceMetrics.headshotPercentage,
        averageDamage: performanceMetrics.averageDamage,
        rrChange: sessionStats.totalRRChange,
        lastMatchResult: sessionStats.lastMatchResult
    };
}

module.exports = {
    calculateRRToGoal,
    calculateSessionStats,
    calculateWinRate,
    calculatePerformanceMetrics,
    getRankProgression,
    calculateSessionSummary
};