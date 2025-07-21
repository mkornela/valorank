const OUTPUT_FILE = 'leaderboard.json';
const fs = require('fs');
const https = require('https');

const API_KEY = 'RGAPI-782179cd-703d-458a-bbdd-a5708aa86d8c';
const ACT_ID = 'aef237a0-494d-3a14-a1c8-ec8de84e309c';
const BASE_URL = 'eu.api.riotgames.com';
const SIZE_PER_REQUEST = 200;
const TARGET_PLAYERS = 10000;

const SAFE_REQUESTS_PER_SECOND = 2;
const SAFE_REQUESTS_PER_2_MINUTES = 55;
const MIN_DELAY_BETWEEN_REQUESTS = 2500;

class RateLimiter {
    constructor() {
        this.requestsInCurrentSecond = 0;
        this.requestsInCurrent2Minutes = 0;
        this.currentSecondStart = Date.now();
        this.current2MinutesStart = Date.now();
        this.lastRequestTime = 0;
    }

    async waitIfNeeded() {
        const now = Date.now();
        
        // Wymuś minimum 100ms między requestami
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
            const waitTime = MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest;
            console.log(`Enforcing minimum delay: waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Reset licznika sekund
        if (now - this.currentSecondStart >= 1000) {
            this.requestsInCurrentSecond = 0;
            this.currentSecondStart = now;
        }
        
        // Reset licznika 2 minut
        if (now - this.current2MinutesStart >= 2 * 60 * 1000) {
            this.requestsInCurrent2Minutes = 0;
            this.current2MinutesStart = now;
        }
        
        // Sprawdź limit na sekundę (BEZPIECZNIE)
        if (this.requestsInCurrentSecond >= SAFE_REQUESTS_PER_SECOND) {
            const waitTime = 1000 - (now - this.currentSecondStart) + 50; // +50ms buffer
            console.log(`⚠️  Approaching rate limit per second. Waiting ${waitTime}ms for safety...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Reset po odczekaniu
            this.requestsInCurrentSecond = 0;
            this.currentSecondStart = Date.now();
        }
        
        // Sprawdź limit na 2 minuty (BEZPIECZNIE)
        if (this.requestsInCurrent2Minutes >= SAFE_REQUESTS_PER_2_MINUTES) {
            const waitTime = 2 * 60 * 1000 - (now - this.current2MinutesStart) + 1000; // +1s buffer
            console.log(`⚠️  Approaching rate limit per 2 minutes. Waiting ${Math.round(waitTime/1000)}s for safety...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Reset po odczekaniu
            this.requestsInCurrent2Minutes = 0;
            this.current2MinutesStart = Date.now();
        }
        
        this.requestsInCurrentSecond++;
        this.requestsInCurrent2Minutes++;
        this.lastRequestTime = Date.now();
        
        console.log(`📊 Rate status: ${this.requestsInCurrentSecond}/${SAFE_REQUESTS_PER_SECOND} per second, ${this.requestsInCurrent2Minutes}/${SAFE_REQUESTS_PER_2_MINUTES} per 2min`);
    }
}

function makeRequest(startIndex) {
    return new Promise((resolve, reject) => {
        const path = `/val/ranked/v1/leaderboards/by-act/${ACT_ID}?size=${SIZE_PER_REQUEST}&startIndex=${startIndex}&api_key=${API_KEY}`;
        
        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'Valorant-Leaderboard-Scraper/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Error parsing JSON: ${error.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function fetchAllPlayers() {
    const rateLimiter = new RateLimiter();
    const allPlayers = [];
    const totalRequests = Math.ceil(TARGET_PLAYERS / SIZE_PER_REQUEST);
    
    console.log(`Starting to fetch ${TARGET_PLAYERS} players...`);
    console.log(`This will require ${totalRequests} requests.`);
    
    for (let i = 0; i < totalRequests; i++) {
        const startIndex = i * SIZE_PER_REQUEST;
        
        try {
            console.log(`Request ${i + 1}/${totalRequests} - fetching players ${startIndex + 1}-${Math.min(startIndex + SIZE_PER_REQUEST, TARGET_PLAYERS)}...`);
            
            await rateLimiter.waitIfNeeded();
            
            const response = await makeRequest(startIndex);
            
            if (response.players && response.players.length > 0) {
                const playersToAdd = response.players.slice(0, TARGET_PLAYERS - allPlayers.length);
                allPlayers.push(...playersToAdd);
                
                console.log(`✓ Fetched ${playersToAdd.length} players. Total: ${allPlayers.length}/${TARGET_PLAYERS}`);
                
                // Jeśli osiągnęliśmy cel, przerwij
                if (allPlayers.length >= TARGET_PLAYERS) {
                    break;
                }
            } else {
                console.log('No more players available or empty response');
                break;
            }
            
            // Dodatkowe opóźnienie między requestami dla bezpieczeństwa
            if (i < totalRequests - 1) {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms zamiast 100ms
            }
            
        } catch (error) {
            console.error(`Error in request ${i + 1}: ${error.message}`);
            
            // W przypadku błędu, poczekaj trochę dłużej przed kolejną próbą
            if (error.message.includes('429') || error.message.includes('rate limit')) {
                console.log('Rate limit error detected. Waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            } else {
                console.log('Waiting 5 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            // Spróbuj ponownie ten sam request
            i--;
        }
    }
    
    return allPlayers;
}

async function main() {
    try {
        console.log('🚀 Starting Valorant Leaderboard scraper...');
        console.log('⏱️  Rate limits: 15 req/s (safe), 80 req/2min (safe) - well below API limits');
        console.log('');
        
        const players = await fetchAllPlayers();
        
        const result = {
            data: {
                players: players
            }
        };
        
        // Zapisz do pliku
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
        
        console.log('');
        console.log(`✅ Success! Fetched ${players.length} players and saved to ${OUTPUT_FILE}`);
        console.log(`📊 Leaderboard range: #${players[0]?.leaderboardRank || 'N/A'} - #${players[players.length - 1]?.leaderboardRank || 'N/A'}`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Obsługa Ctrl+C
process.on('SIGINT', () => {
    console.log('\n⚠️  Process interrupted. Exiting gracefully...');
    process.exit(0);
});

// Uruchom skrypt
main();