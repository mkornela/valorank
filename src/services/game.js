const { RANK_TIERS, RADIANT_BASE_THRESHOLD } = require('../constants');
const log = require('../utils/logger');

/**
 * Calculate RR needed to reach next rank
 * @param {number} currentTier - Current tier ID
 * @param {number} currentRR - Current RR in tier
 * @returns {Object} Object containing RR needed and goal rank
 */
function calculateRRToGoal(currentTier, currentRR) {
    if (currentTier === 27) { 
        return { rr: 0, goal: "Radiant!" }; 
    }
    
    if (currentTier >= 26) { 
        const totalRRneeded = RADIANT_BASE_THRESHOLD;
        return { rr: totalRRneeded, goal: "Radiant" };
    }
    
    const rrToNext = Math.max(0, 100 - currentRR);
    const nextGoalRank = RANK_TIERS[currentTier + 1] || "Następna ranga";
    return { rr: rrToNext, goal: nextGoalRank };
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
function calculateSessionStats(matchHistoryData, mmrHistoryArray, playerPuuid, sessionStartTime, sessionEndTime) {
   let wins = 0, losses = 0, draws = 0, totalRRChange = 0, latestMap = null, lastMatchResult = null, lastMatchRR = null;
   
   if (Array.isArray(mmrHistoryArray)) {
       let isFirstRRMatchInSession = true;
       for (const entry of mmrHistoryArray) {
           let entryDate, rrChange;

           if (entry.date) {
               entryDate = new Date(entry.date);
               rrChange = entry.last_change;
           } else if (entry.date_raw) {
               entryDate = new Date(entry.date_raw * 1000);
               rrChange = entry.mmr_change_to_last_game;
           } else {
               continue;
           }

           if (!isNaN(entryDate.getTime()) && entryDate >= sessionStartTime && entryDate < sessionEndTime) {
               if (typeof rrChange === 'number') {
                   totalRRChange += rrChange;
                   if (isFirstRRMatchInSession) {
                       lastMatchRR = rrChange;
                       isFirstRRMatchInSession = false;
                   }
               }
           }
       }
   }
   
   if (matchHistoryData && Array.isArray(matchHistoryData.data) && matchHistoryData.data.length > 0) {
       let isFirstMatch = true;
       for (const match of matchHistoryData.data) {
           let matchStartTime = null;
           try { matchStartTime = new Date(match.metadata.started_at); } catch (e) { continue; }
           
           if (!matchStartTime || isNaN(matchStartTime.getTime()) || matchStartTime < sessionStartTime || matchStartTime >= sessionEndTime) continue;
           if (!match.players.some(p => p.puuid === playerPuuid)) continue;
           
           if (isFirstMatch) {
               if (match.metadata.map?.name) latestMap = match.metadata.map.name;
           }
           
           const playerInMatch = match.players.find(p => p.puuid === playerPuuid);
           const playerTeam = match.teams.find(team => team.team_id === playerInMatch.team_id);
           const enemyTeam = match.teams.find(team => team.team_id !== playerInMatch.team_id);

           if (playerTeam && enemyTeam) {
               const isDraw = playerTeam.won === false && enemyTeam.won === false;
               if (isDraw) {
                   draws++;
                   if(isFirstMatch) lastMatchResult = 'D';
               } else if (playerTeam.won === true) {
                   wins++;
                   if(isFirstMatch) lastMatchResult = 'W';
               } else {
                   losses++;
                   if(isFirstMatch) lastMatchResult = 'L';
               }
               if(isFirstMatch) isFirstMatch = false;
           }
       }
   }

   return { wins, losses, draws, totalRRChange, latestMap, lastMatchResult, lastMatchRR };
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