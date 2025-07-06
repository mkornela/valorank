const { RANK_TIERS, RADIANT_BASE_THRESHOLD } = require('../constants');
const { getLeaderboardData } = require('../data/leaderboard'); 

function calculateRRToGoal(currentTier, currentRR) {
    if (currentTier === 27) { 
        return { rr: 0, goal: "Jesteś na szczycie!" }; 
    }
    
    if (currentTier >= 26) { 
        let radiantRequiredRR = RADIANT_BASE_THRESHOLD;
        
        const leaderboardData = getLeaderboardData();
        const leaderboard = leaderboardData?.data?.players;

        if (leaderboard && leaderboard.length >= 500) {
            const top500cutoff = (leaderboard[499]?.rankedRating || 0) + 1;
            radiantRequiredRR = Math.max(RADIANT_BASE_THRESHOLD, top500cutoff);
        }
        
        const totalRRneeded = Math.max(0, radiantRequiredRR - currentRR);
        return { rr: totalRRneeded, goal: "Radiant" };
    }
    
    const rrToNext = Math.max(0, 100 - currentRR);
    const nextGoalRank = RANK_TIERS[currentTier + 1] || "Następna ranga";
    
    return { rr: rrToNext, goal: nextGoalRank };
}

function calculateSessionStats(matchHistoryData, playerPuuid, sessionStartTime, sessionEndTime) {
    let wins = 0, losses = 0, draws = 0, latestMap = null, lastMatchResult = null, lastMatchRR = null;
    
    if (!matchHistoryData || !Array.isArray(matchHistoryData.data) || matchHistoryData.data.length === 0) { 
        return { wins, losses, draws, latestMap, lastMatchResult, lastMatchRR }; 
    }
    
    const sortedMatches = matchHistoryData.data;
    let isFirstMatch = true;
    
    for (let i = 0; i < sortedMatches.length; i++) {
        const match = sortedMatches[i];
        let matchStartTime = null;
        
        try { 
            if (match.metadata.started_at) { 
                matchStartTime = new Date(match.metadata.started_at); 
            } 
        } catch (e) { 
            continue; 
        }
        
        if (!matchStartTime || isNaN(matchStartTime.getTime())) { 
            continue; 
        }
        
        const playerInMatch = match.players.find(p => p.puuid === playerPuuid);
        if (!playerInMatch) { 
            continue; 
        }
        
        if (matchStartTime >= sessionStartTime && matchStartTime < sessionEndTime) {
            if (!latestMap && match.metadata.map?.name) { 
                latestMap = match.metadata.map.name; 
            }
            
            const allTeams = match.teams;
            const playerTeam = allTeams.find(team => team.team_id === playerInMatch.team_id);
            const enemyTeam = allTeams.find(team => team.team_id !== playerInMatch.team_id);
            
            if (playerTeam && enemyTeam) {
                const playerRounds = playerTeam.rounds?.won || 0;
                const enemyRounds = enemyTeam.rounds?.won || 0;
                
                const isDraw = (playerRounds === enemyRounds && playerRounds > 0) || 
                              (playerTeam.won === false && enemyTeam.won === false);
                
                let matchResult;
                if (isDraw) {
                    draws++;
                    matchResult = 'D';
                } else if (playerTeam.won === true) {
                    wins++;
                    matchResult = 'W';
                } else {
                    losses++;
                    matchResult = 'L';
                }
                
                if (isFirstMatch) {
                    lastMatchResult = matchResult;
                    let rrChange = null;
                    if (playerInMatch.economy && typeof playerInMatch.economy.rr_change === 'number') { rrChange = playerInMatch.economy.rr_change; }
                    else if (typeof playerInMatch.rr_change === 'number') { rrChange = playerInMatch.rr_change; }
                    else if (playerInMatch.stats && typeof playerInMatch.stats.rr_change === 'number') { rrChange = playerInMatch.stats.rr_change; }
                    else if (playerInMatch.tier && typeof playerInMatch.tier.rr_change === 'number') { rrChange = playerInMatch.tier.rr_change; }
                    
                    if (rrChange !== null) { lastMatchRR = rrChange; }
                    isFirstMatch = false;
                }
            }
        }
    }
    
    return { wins, losses, draws, latestMap, lastMatchResult, lastMatchRR };
}

module.exports = {
    calculateRRToGoal,
    calculateSessionStats
};