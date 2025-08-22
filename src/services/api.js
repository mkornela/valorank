const config = require('../config');
const { MAX_MATCHES_PER_REQUEST } = require('../constants');
const log = require('../utils/logger');
const { logToDiscord } = require('../utils/discord');
const NodeCache = require('node-cache');

// Initialize cache with TTL from configuration
const cache = new NodeCache({ 
  stdTTL: config.CACHE_TTL_SECONDS,
  checkperiod: 60, // Check for expired items every minute
  useClones: false // Better performance
});

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0
};

/**
 * Custom API error class
 */
class APIError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

let fetch;

/**
 * Initialize fetch dynamically
 */
async function initFetch() {
  if (typeof globalThis.fetch === 'undefined') {
    const module = await import('node-fetch');
    fetch = module.default;
  } else {
    fetch = globalThis.fetch;
  }
}

/**
 * Generate cache key for API requests
 */
function generateCacheKey(urlPath, queryParams = {}) {
  const sortedParams = Object.keys(queryParams)
    .sort()
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');
  return `${urlPath}${sortedParams ? '?' + sortedParams : ''}`;
}

/**
 * Get data from cache or fetch and cache it
 */
async function getWithCache(key, fetchFunction, ttl = config.CACHE_TTL_SECONDS) {
  try {
    // Check cache first
    const cachedData = cache.get(key);
    if (cachedData) {
      cacheStats.hits++;
      log.debug('CACHE', `Cache hit for key: ${key.substring(0, 50)}...`);
      return cachedData;
    }
    
    // Fetch fresh data
    cacheStats.misses++;
    log.debug('CACHE', `Cache miss for key: ${key.substring(0, 50)}...`);
    const freshData = await fetchFunction();
    
    // Cache the result
    cache.set(key, freshData, ttl);
    cacheStats.sets++;
    
    return freshData;
  } catch (error) {
    log.error('CACHE', `Error in getWithCache for key: ${key.substring(0, 50)}...`, error);
    throw error;
  }
}

/**
 * Fetch data from HenrikDev API with enhanced error handling
 */
async function fetchFromHenrikApi(urlPath, queryParams = {}) {
  if (!fetch) await initFetch();
  
  const baseUrl = 'https://api.henrikdev.xyz';
  let fullUrl = `${baseUrl}${urlPath}`;
  const searchParams = new URLSearchParams(queryParams);
  
  if (searchParams.toString()) { 
    fullUrl += `?${searchParams.toString()}`; 
  }
  
  // Generate cache key
  const cacheKey = generateCacheKey(urlPath, queryParams);
  
  return getWithCache(cacheKey, async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);
      
      const response = await fetch(fullUrl, { 
        headers: { 
          'Authorization': config.HENRIKDEV_API_KEY,
          'User-Agent': 'Valorank/3.1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) { 
        let errorData; 
        try { 
          errorData = await response.json(); 
        } catch (e) { 
          errorData = { message: await response.text() }; 
        }
        
        throw new APIError(
          `HenrikDev API error! Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`,
          response.status,
          { url: fullUrl, response: errorData }
        ); 
      }
      
      const data = await response.json();
      
      if (data.status && data.status !== 200) { 
        throw new APIError(
          `HenrikDev API returned status ${data.status}: ${data.message || JSON.stringify(data.errors || data.details)}`,
          data.status,
          { url: fullUrl, response: data }
        ); 
      }
      
      return data;
    } catch (error) { 
      if (error.name === 'AbortError') {
        throw new APIError(
          `Request timeout after ${config.API_TIMEOUT_MS}ms`,
          408,
          { url: fullUrl }
        );
      }
      
      log.error('API', `Error fetching ${fullUrl}`, error); 
      throw error; 
    }
  });
}

/**
 * Helper function to deduplicate matches by match ID
 */
function deduplicateMatches(matches) {
  if (!Array.isArray(matches)) {
    return matches;
  }
  
  const seen = new Set();
  const uniqueMatches = matches.filter(match => {
    const matchId = match.metadata?.match_id || match.meta?.matchid;
    if (!matchId) return true; // Keep matches without ID (shouldn't happen but safe)
    
    if (seen.has(matchId)) {
      return false; // Skip duplicate
    }
    seen.add(matchId);
    return true;
  });
  
  // Log if duplicates were found
  if (uniqueMatches.length < matches.length) {
    const duplicateCount = matches.length - uniqueMatches.length;
    log.info('DEDUP', `Removed ${duplicateCount} duplicate matches from API response`);
  }
  
  return uniqueMatches;
}

/**
 * Fetch account details with caching
 */
async function fetchAccountDetails(name, tag) { 
  const validationError = validatePlayerInput(name, tag);
  if (validationError) {
    throw new APIError(validationError, 400);
  }
  
  return fetchFromHenrikApi(`/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`); 
}

/**
 * Fetch player MMR with caching
 */
async function fetchPlayerMMR(name, tag, region) { 
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    throw new APIError(validationError, 400);
  }
  
  return fetchFromHenrikApi(`/valorant/v2/mmr/${region.toLowerCase()}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`); 
}

/**
 * Fetch MMR history for daily stats (v2 endpoint)
 */
async function fetchMMRHistoryDaily(name, tag, region) {
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    throw new APIError(validationError, 400);
  }
  
  const platform = 'pc';
  return fetchFromHenrikApi(`/valorant/v2/mmr-history/${region.toLowerCase()}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

/**
 * Fetch MMR history for session stats (v1 endpoint)
 */
async function fetchMMRHistory(name, tag, region) {
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    throw new APIError(validationError, 400);
  }
  
  return fetchFromHenrikApi(`/valorant/v1/mmr-history/${region.toLowerCase()}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

/**
 * Fetch match history with pagination support
 */
async function fetchMatchHistory(name, tag, region, gameMode = 'competitive', totalSize = 25) {
  const validationError = validatePlayerInput(name, tag, region);
  if (validationError) {
    throw new APIError(validationError, 400);
  }
  
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
    
    // Deduplicate matches before sorting
    allMatches = deduplicateMatches(allMatches);
    
    allMatches.sort((a, b) => new Date(b.metadata.game_start_iso).getTime() - new Date(a.metadata.game_start_iso).getTime());
    log.info('API', `Fetched ${allMatches.length} matches in ${responses.length} requests for ${name}#${tag}`);
    
    return { status: 200, data: allMatches.slice(0, totalSize) };
  } catch (error) { 
    log.error('API', `Error fetching match history for ${name}#${tag}`, error); 
    throw error; 
  }
}

/**
 * Fetch leaderboard data
 */
async function fetchLeaderboard(region) {
  const validRegions = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];
  if (!validRegions.includes(region.toLowerCase())) {
    throw new APIError(`Invalid region: ${region}. Valid regions: ${validRegions.join(', ')}`, 400);
  }
  
  log.info('API', `Fetching live leaderboard for region: ${region}`);
  return fetchFromHenrikApi(`/valorant/v3/leaderboard/${region.toLowerCase()}/pc`);
}

/**
 * Check API status
 */
async function checkApiStatus(region = 'eu') {
  try {
    const data = await fetchFromHenrikApi(`/valorant/v1/version/${region}`);
    return { reachable: true, data: data };
  } catch (error) {
    log.warn('API_CHECK', `HenrikDev API ping failed: ${error.message}`);
    return { reachable: false, error: error.message };
  }
}

/**
 * Validate player input parameters
 */
function validatePlayerInput(name, tag, region = null) {
  // Decode URL-encoded characters (like %20 for space)
  const decodedName = decodeURIComponent(name);
  
  if (!decodedName || typeof decodedName !== 'string' || decodedName.length < 3 || decodedName.length > 16) {
    return 'Player name must be between 3 and 16 characters';
  }
  
  if (!tag || typeof tag !== 'string' || tag.length < 3 || tag.length > 5) {
    return 'Player tag must be between 3 and 5 characters';
  }
  
  // Validate name format - allow letters, numbers, spaces, underscores, hyphens, and common special characters
  // Based on VALORANT naming conventions
  if (!/^[\p{L}\p{N}_\-\s\.]+$/u.test(decodedName)) {
    return 'Player name contains invalid characters';
  } 
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const stats = cache.getStats();
  return {
    ...cacheStats,
    keys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses) * 100,
    vsize: stats.vsize
  };
}

/**
 * Clear cache
 */
function clearCache() {
  cache.flushAll();
  cacheStats.deletes++;
  log.info('CACHE', 'Cache cleared');
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
  checkApiStatus,
  validatePlayerInput,
  getCacheStats,
  clearCache,
  APIError
};