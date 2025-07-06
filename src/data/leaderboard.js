const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

let LB_DATA = null;

function loadLeaderboardData() {
    try {
        const dataPath = path.join(__dirname, 'leaderboard.json');
        
        if (fs.existsSync(dataPath)) {
            const rawData = fs.readFileSync(dataPath, 'utf8');
            LB_DATA = JSON.parse(rawData);
            log.info('LEADERBOARD', 'Static leaderboard data loaded successfully.');
        } else {
            log.warn('LEADERBOARD', 'Static leaderboard.json file not found, using empty data. Please create the file.');
            LB_DATA = { data: { players: [] } };
        }
    } catch (error) {
        log.error('LEADERBOARD', 'Error loading static leaderboard data.', error);
        LB_DATA = { data: { players: [] } };
    }
}

function getLeaderboardData() {
    if (!LB_DATA) {
        loadLeaderboardData();
    }
    return LB_DATA;
}

function findPlayerByRank(position) {
    const data = getLeaderboardData();
    if (!data.data || !Array.isArray(data.data.players)) {
        return null;
    }
    
    return data.data.players.find(p => p.leaderboardRank === position);
}

loadLeaderboardData();

module.exports = {
    getLeaderboardData,
    findPlayerByRank
};