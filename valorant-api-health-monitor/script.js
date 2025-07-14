#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Konfiguracja
const CONFIG = {
    // URL do twojego API
    API_URL: 'http://localhost:3000/health', // Zmień na właściwy URL i port
    
    // Discord webhook URL (opcjonalnie)
    DISCORD_WEBHOOK_URL: '', // Wklej tutaj URL webhook'a Discord
    
    // Interwał sprawdzania (5 minut)
    CHECK_INTERVAL: 5 * 60 * 1000, // 5 minut w milisekundach
    
    // Liczba nieudanych prób przed alertem
    MAX_FAILURES: 3,
    
    // Timeout dla requestów (30 sekund)
    REQUEST_TIMEOUT: 30 * 1000,
    
    // Plik do przechowywania stanu
    STATE_FILE: './health_monitor_state.json'
};

class HealthMonitor {
    constructor() {
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.isServiceDown = false;
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(CONFIG.STATE_FILE)) {
                const state = JSON.parse(fs.readFileSync(CONFIG.STATE_FILE, 'utf8'));
                this.failureCount = state.failureCount || 0;
                this.lastFailureTime = state.lastFailureTime ? new Date(state.lastFailureTime) : null;
                this.isServiceDown = state.isServiceDown || false;
            }
        } catch (error) {
            console.error('Błąd podczas ładowania stanu:', error);
        }
    }

    saveState() {
        try {
            const state = {
                failureCount: this.failureCount,
                lastFailureTime: this.lastFailureTime,
                isServiceDown: this.isServiceDown,
                lastUpdate: new Date().toISOString()
            };
            fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Błąd podczas zapisywania stanu:', error);
        }
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: CONFIG.REQUEST_TIMEOUT,
                headers: {
                    'User-Agent': 'HealthMonitor/1.0'
                }
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        data: data,
                        headers: res.headers
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async sendDiscordAlert(message, isError = false) {
        if (!CONFIG.DISCORD_WEBHOOK_URL) return;

        try {
            const embed = {
                title: isError ? '🔴 ALERT: Serwis niedostępny' : '🟢 INFO: Serwis przywrócony',
                description: message,
                color: isError ? 0xFF0000 : 0x00FF00,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Health Monitor'
                }
            };

            const payload = JSON.stringify({
                embeds: [embed]
            });

            const webhookUrl = new URL(CONFIG.DISCORD_WEBHOOK_URL);
            const options = {
                hostname: webhookUrl.hostname,
                port: webhookUrl.port || 443,
                path: webhookUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = https.request(options);
            req.write(payload);
            req.end();
        } catch (error) {
            console.error('Błąd podczas wysyłania alertu Discord:', error);
        }
    }

    async checkHealth() {
        const timestamp = new Date().toISOString();
        
        try {
            console.log(`[${timestamp}] Sprawdzanie healthcheck...`);
            
            const response = await this.makeRequest(CONFIG.API_URL);
            
            if (response.statusCode === 200) {
                // Serwis działa
                if (this.isServiceDown) {
                    // Serwis został przywrócony
                    console.log(`[${timestamp}] ✅ Serwis przywrócony!`);
                    await this.sendDiscordAlert(
                        `Serwis został przywrócony po ${this.failureCount} nieudanych próbach.`
                    );
                    this.isServiceDown = false;
                }
                
                this.failureCount = 0;
                this.lastFailureTime = null;
                console.log(`[${timestamp}] ✅ Healthcheck OK`);
            } else {
                throw new Error(`HTTP ${response.statusCode}`);
            }
            
        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = new Date();
            
            console.log(`[${timestamp}] ❌ Healthcheck failed (${this.failureCount}/${CONFIG.MAX_FAILURES}): ${error.message}`);
            
            if (this.failureCount >= CONFIG.MAX_FAILURES && !this.isServiceDown) {
                this.isServiceDown = true;
                const alertMessage = `Serwis nie odpowiada już przez ${CONFIG.MAX_FAILURES} sprawdzeń!\n\n` +
                    `URL: ${CONFIG.API_URL}\n` +
                    `Ostatni błąd: ${error.message}\n` +
                    `Czas ostatniej awarii: ${this.lastFailureTime.toISOString()}`;
                
                console.log(`[${timestamp}] 🚨 ALERT: Wysyłam powiadomienie!`);
                await this.sendDiscordAlert(alertMessage, true);
            }
        }
        
        this.saveState();
    }

    start() {
        console.log('🚀 Health Monitor uruchomiony');
        console.log(`📡 Sprawdzanie: ${CONFIG.API_URL}`);
        console.log(`⏰ Interwał: ${CONFIG.CHECK_INTERVAL / 1000}s`);
        console.log(`🔄 Maksymalne niepowodzenia: ${CONFIG.MAX_FAILURES}`);
        console.log(`${CONFIG.DISCORD_WEBHOOK_URL ? '✅' : '❌'} Discord webhook: ${CONFIG.DISCORD_WEBHOOK_URL ? 'włączony' : 'wyłączony'}`);
        console.log('---');

        // Pierwszy check natychmiast
        this.checkHealth();
        
        // Następne co określony interwał
        setInterval(() => {
            this.checkHealth();
        }, CONFIG.CHECK_INTERVAL);
    }

    stop() {
        console.log('🛑 Health Monitor zatrzymany');
        process.exit(0);
    }
}

// Obsługa sygnałów
const monitor = new HealthMonitor();

process.on('SIGINT', () => {
    console.log('\n🛑 Otrzymano SIGINT, zatrzymuję monitor...');
    monitor.stop();
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Otrzymano SIGTERM, zatrzymuję monitor...');
    monitor.stop();
});

// Uruchomienie
monitor.start();