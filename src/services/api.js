const config = require('../config');
const { MAX_MATCHES_PER_REQUEST } = require('../constants');
const log = require('../utils/logger');
const { logToDiscord } = require('../utils/discord');

let fetch;

async function initFetch() {
    if (typeof globalThis.fetch === 'undefined') {
        const module = await import('node-fetch');
        fetch = module.default;
    } else {
        fetch = globalThis.fetch;
    }
}

async function fetchFromHenrikApi(urlPath, queryParams = {}) {
    if (!fetch) await initFetch();
    
    const baseUrl = 'https://api.henrikdev.xyz';
    let fullUrl = `${baseUrl}${urlPath}`;
    const searchParams = new URLSearchParams(queryParams);
    
    if (searchParams.toString()) { 
        fullUrl += `?${searchParams.toString()}`; 
    }
    
    try {
        const response = await fetch(fullUrl, { 
            headers: { 'Authorization': config.HENRIKDEV_API_KEY }, 
            timeout: 15000 
        });
        
        if (!response.ok) { 
            let errorData; 
            try { 
                errorData = await response.json(); 
            } catch (e) { 
                errorData = { message: await response.text() }; 
            } 
            throw new Error(`HenrikDev API error! Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`); 
        }
        
        const data = await response.json();
        
        if (data.status && data.status !== 200) { 
            throw new Error(`HenrikDev API returned status ${data.status}: ${data.message || JSON.stringify(data.errors || data.details)}`); 
        }
        
        return data;
    } catch (error) { 
        log.error('API', `Error fetching ${fullUrl}`, error); 
        throw error; 
    }
}

async function fetchAccountDetails(name, tag) { 
    return fetchFromHenrikApi(`/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`); 
}

async function fetchPlayerMMR(name, tag, region) { 
    return fetchFromHenrikApi(`/valorant/v2/mmr/${region.toLowerCase()}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`); 
}

// Funkcja dla /daily, używa endpointu v2
async function fetchMMRHistoryDaily(name, tag, region) {
    const platform = 'pc';
    return fetchFromHenrikApi(`/valorant/v2/mmr-history/${region.toLowerCase()}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

// Funkcja dla /wl i /advanced_wl, używa endpointu v1
async function fetchMMRHistory(name, tag, region) {
    return fetchFromHenrikApi(`/valorant/v1/mmr-history/${region.toLowerCase()}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

async function fetchMatchHistory(name, tag, region, gameMode = 'competitive', totalSize = 25) {
    const platform = 'pc';
    const numRequests = Math.ceil(totalSize / MAX_MATCHES_PER_REQUEST);
    const requests = [];
    
    for (let i = 0; i < numRequests; i++) {
        const start = i * MAX_MATCHES_PER_REQUEST;
        const sizeForThisRequest = Math.min(MAX_MATCHES_PER_REQUEST, totalSize - start);
        
        if (sizeForThisRequest <= 0) continue;
        
        const queryParams = { 
            mode: gameMode, 
            size: sizeForThisRequest.toString(), 
            start: start.toString() 
        };
        
        const urlPath = `/valorant/v4/matches/${region.toLowerCase()}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
        requests.push(fetchFromHenrikApi(urlPath, queryParams));
    }
    
    try {
        const responses = await Promise.all(requests);
        let allMatches = [];
        
        for (const response of responses) { 
            if (response.data && Array.isArray(response.data)) { 
                allMatches = allMatches.concat(response.data); 
            } 
        }
        
        allMatches.sort((a, b) => new Date(b.metadata.game_start_iso).getTime() - new Date(a.metadata.game_start_iso).getTime());
        log.info('API', `Fetched ${allMatches.length} matches in ${responses.length} requests for ${name}#${tag}`);
        
        return { status: 200, data: allMatches.slice(0, totalSize) };
    } catch (error) { 
        log.error('API', `Error fetching match history for ${name}#${tag}`, error); 
        throw error; 
    }
}

async function fetchLeaderboard(region) {
    log.info('API', `Fetching live leaderboard for region: ${region}`);
    return fetchFromHenrikApi(`/valorant/v3/leaderboard/${region.toLowerCase()}/pc`);
}

async function checkApiStatus(region = 'eu') {
    try {
        const data = await fetchFromHenrikApi(`/valorant/v1/status/${region}`);
        return { reachable: true, data: data };
    } catch (error) {
        log.warn('API_CHECK', `Ping do HenrikDev API nie powiódł się: ${error.message}`);
        return { reachable: false, error: error.message };
    }
}

module.exports = {
    initFetch,
    fetchFromHenrikApi,
    fetchAccountDetails,
    fetchPlayerMMR,
    fetchMMRHistory,
    fetchMMRHistoryDaily,
    fetchMatchHistory,
    fetchLeaderboard,
    checkApiStatus
};