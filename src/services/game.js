const { RANK_TIERS, RADIANT_BASE_THRESHOLD } = require('../constants');
const { getLeaderboardData } = require('../data/leaderboard'); 

function calculateRRToGoal(currentTier, currentRR, liveLeaderboardPlayers = null) {
    if (currentTier === 27) { 
        return { rr: 0, goal: "Radiant!" }; 
    }
    
    if (currentTier >= 26) { 
        let radiantRequiredRR = RADIANT_BASE_THRESHOLD;
        const players = liveLeaderboardPlayers || getLeaderboardData().data?.players;
        if (players && players.length >= 500) {
            const top500cutoff = (players[499]?.rankedRating || 0) + 1;
            radiantRequiredRR = Math.max(RADIANT_BASE_THRESHOLD, top500cutoff);
        }
        const totalRRneeded = Math.max(0, radiantRequiredRR - currentRR);
        return { rr: totalRRneeded, goal: "Radiant" };
    }
    
    const rrToNext = Math.max(0, 100 - currentRR);
    const nextGoalRank = RANK_TIERS[currentTier + 1] || "Następna ranga";
    return { rr: rrToNext, goal: nextGoalRank };
}

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

module.exports = {
    calculateRRToGoal,
    calculateSessionStats
};