const { RANK_TIERS, RADIANT_BASE_THRESHOLD } = require('../constants');
const { getLeaderboardData } = require('../data/leaderboard'); 

function calculateRRToGoal(currentTier, currentRR, liveLeaderboardPlayers = null) {
    if (currentTier === 27) { 
        return { rr: 0, goal: "Jesteś na szczycie!" }; 
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
   
   // 1. Oblicz bilans RR bezpośrednio z historii MMR na podstawie czasu, obsługując oba formaty API (v1 i v2)
   if (Array.isArray(mmrHistoryArray)) {
       let isFirstRRMatchInSession = true;
       for (const entry of mmrHistoryArray) {
           let entryDate, rrChange;

           // Sprawdź format danych i przypisz odpowiednie wartości
           if (entry.date) { // Format z v2 API
               entryDate = new Date(entry.date);
               rrChange = entry.last_change;
           } else if (entry.date_raw) { // Format z v1 API
               entryDate = new Date(entry.date_raw * 1000); // Unix timestamp
               rrChange = entry.mmr_change_to_last_game;
           } else {
               continue; // Pomiń wpis, jeśli nie ma daty
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
   
   // 2. Oblicz W/L/D i dane ostatniego meczu z historii meczów
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