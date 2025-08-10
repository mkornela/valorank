const express = require('express');
const path = require('path');
const fs = require('fs');
const { checkApiStatus } = require('../services/api');
const log = require('../utils/logger');
const config = require('../config');
const { logToDiscord } = require('../utils/discord');

const router = express.Router();
const STATUS_DATA_PATH = path.join(process.cwd(), 'status-data.json');
const HISTORY_PATH = path.join(process.cwd(), 'status_history');

router.get('/api/status/data', async (req, res) => {
    try {
        const statusDataRaw = await fs.readFile(STATUS_DATA_PATH, 'utf-8');
        const statusData = JSON.parse(statusDataRaw);
        res.json(statusData);
    } catch (error) {
        log.error('API_STATUS', 'Nie można odczytać pliku status-data.json', error);
        res.status(500).json({ error: 'Błąd po stronie serwera.' });
    }
});

router.post('/api/status/incidents', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== config.API_SECRET_KEY) {
        return res.status(401).json({ error: 'Brak autoryzacji' });
    }

    const { message, status } = req.body;
    if (!message || !status || !['operational', 'degraded', 'error', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Nieprawidłowe dane. Wymagane: message, status.' });
    }

    try {
        const statusDataRaw = await fs.promises.readFile(STATUS_DATA_PATH, 'utf-8');
        const data = JSON.parse(statusDataRaw);
        const today = new Date().toISOString().split('T')[0];

        data.incidents.unshift({ date: today, message, status });
        data.history[today] = status;

        await fs.promises.writeFile(STATUS_DATA_PATH, JSON.stringify(data, null, 2));
        log.info('API_STATUS', `Dodano nowy incydent przez bota: [${status}]`);
        res.status(201).json({ success: true, message: 'Incydent dodany pomyślnie.' });

    } catch (error) {
        log.error('API_STATUS', 'Nie można zapisać nowego incydentu', error);
        res.status(500).json({ error: 'Błąd zapisu po stronie serwera.' });
    }
});

router.get('/statystyki', (req, res) => {
    const statsFilePath = path.join(process.cwd(), 'valorant_stats.html');
    if (fs.existsSync(statsFilePath)) {
        logToDiscord({
            title: 'API Call Success: `/statystyki`',
            color: 0x00FF00,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${req.ip}` }
        });
        res.sendFile(statsFilePath);
    } else {
        logToDiscord({
            title: 'API Call Failed: `/statystyki`',
            color: 0xFFA500,
            description: 'Stats file not found. It may be generating.',
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${req.ip}` }
        }, true);
        res.status(503).send('Statystyki są w trakcie generowania. Proszę odświeżyć stronę za chwilę.');
    }
});

router.get('/challengetoradiant', (req, res) => {
    const statsFilePath = path.join(process.cwd(), 'torad_valorant_stats.html');
    if (fs.existsSync(statsFilePath)) {
        logToDiscord({
            title: 'API Call Success: `/challengetoradiant`',
            color: 0x00FF00,
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${req.ip}` }
        });
        res.sendFile(statsFilePath);
    } else {
        logToDiscord({
            title: 'API Call Failed: `/challengetoradiant`',
            color: 0xFFA500,
            description: 'Stats file not found. It may be generating.',
            timestamp: new Date().toISOString(),
            footer: { text: `IP: ${req.ip}` }
        }, true);
        res.status(503).send('Statystyki są w trakcie generowania. Proszę odświeżyć stronę za chwilę.');
    }
});

router.get('/display', (req, res) => {
    const displayFilePath = path.join(process.cwd(), 'display.html');
    if (fs.existsSync(displayFilePath)) {
        res.sendFile(displayFilePath);
    } else {
        res.status(404).send('Błąd API. Skontaktuj się z administratorem!');
    }
});

router.get('/health', async (req, res) => { // Endpoint jest teraz asynchroniczny
    try {
        const statsFileExists = fs.existsSync(path.join(process.cwd(), 'valorant_stats.html'));
        const docsFileExists = fs.existsSync(path.join(process.cwd(), 'docs.html'));
        const apiStatus = await checkApiStatus(); // Sprawdzamy status API

        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);

        let overallStatus = 'operational';
        if (!statsFileExists || !apiStatus.reachable) {
            overallStatus = 'degraded';
        }

        const healthStatus = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: uptimeSeconds.toFixed(0),
                human: `${hours}h ${minutes}m`
            },
            checks: {
                henrik_api: {
                    reachable: apiStatus.reachable,
                    status: apiStatus.reachable ? 'ok' : 'unreachable'
                },
                stats_file: {
                    exists: statsFileExists,
                    status: statsFileExists ? 'ok' : 'missing'
                },
                docs_file: {
                    exists: docsFileExists,
                    status: docsFileExists ? 'ok' : 'generated'
                }
            },
            version: process.version
        };

        const httpStatus = overallStatus === 'operational' ? 200 : 503;
        log.info('HEALTH', `Health check from ${req.ip}: ${overallStatus.toUpperCase()}`);
        res.status(httpStatus).json(healthStatus);

    } catch (error) {
        log.error('HEALTH', 'Health check failed critically', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

//REQUIRED BY RIOT FOR ME TO OBTAIN THEIR API KEY
//REQUIRED BY RIOT FOR ME TO OBTAIN THEIR API KEY
//REQUIRED BY RIOT FOR ME TO OBTAIN THEIR API KEY
router.get('/riot.txt', (req, res) => {
    const riotFilePath = path.join(process.cwd(), 'riot.txt');
    
    if (fs.existsSync(riotFilePath)) {
        res.setHeader('Content-Type', 'text/plain');
        res.sendFile(riotFilePath);
        log.info('RIOT_VERIFICATION', `Riot verification file accessed from ${req.ip}`);
    } else {
        log.error('RIOT_VERIFICATION', 'Riot.txt file not found');
        res.status(404).send('Riot verification file not found');
    }
});

router.get('/api/status/details', async (req, res) => {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Nieprawidłowy format daty. Oczekiwano YYYY-MM-DD.' });
    }
    const filePath = path.join(HISTORY_PATH, `${date}.json`);
    try {
        const dayDataRaw = await fs.promises.readFile(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.send(dayDataRaw);
    } catch (error) {
        log.warn('API_STATUS_DETAILS', `Brak pliku historii dla daty: ${date}`);
        res.json({});
    }
});

router.get('/api/status', async (req, res) => {
    try {
        const apiStatus = await checkApiStatus();
        const statsFileExists = fs.existsSync(path.join(process.cwd(), 'valorant_stats.html'));

        const automatedChecks = {
            henrik_api: { name: 'Zewnętrzne API (Henrik)', description: 'Kluczowe API dostarczające dane o grze.', status: apiStatus.reachable ? 'operational' : 'error' },
            stats_file: { name: 'Generator Statystyk', description: 'Proces generowania plików ze statystykami.', status: statsFileExists ? 'operational' : 'degraded' }
        };
        
        const statusDataRaw = await fs.promises.readFile(STATUS_DATA_PATH, 'utf-8');
        const incidentData = JSON.parse(statusDataRaw);

        const history = {};
        const today = new Date();
        for (let i = 89; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const filePath = path.join(HISTORY_PATH, `${dateString}.json`);
            
            try {
                const dayDataRaw = await fs.promises.readFile(filePath, 'utf-8');
                const dayData = JSON.parse(dayDataRaw);
                const statuses = Object.values(dayData).map(v => v.status);
                
                if (statuses.some(s => s === 'error')) history[dateString] = 'error';
                else if (statuses.some(s => s === 'degraded')) history[dateString] = 'degraded';
                else history[dateString] = 'operational';
            } catch (error) {
                history[dateString] = 'no-data';
            }
        }

        const statusPriority = { operational: 1, maintenance: 2, degraded: 3, error: 4 };
        let finalStatus = 'operational';
        Object.values(automatedChecks).forEach(check => {
            if (statusPriority[check.status] > statusPriority[finalStatus]) finalStatus = check.status;
        });
        
        const latestIncident = incidentData.incidents[0];
        if (latestIncident && statusPriority[latestIncident.status] > statusPriority[finalStatus]) {
            finalStatus = latestIncident.status;
        }

        res.json({
            overallStatus: finalStatus,
            services: automatedChecks,
            incidents: incidentData.incidents.slice(0, 10),
            history: history
        });

    } catch (error) {
        log.error('API_STATUS', 'Krytyczny błąd podczas pobierania danych statusu', error);
        res.status(500).json({ error: 'Nie udało się pobrać danych statusu.' });
    }
});

router.get('/', (req, res) => {
    const docsFilePath = path.join(process.cwd(), 'docs.html');
    res.sendFile(docsFilePath);
});

router.get('/status', (req, res) => {
    const statusFilePath = path.join(process.cwd(), 'status_page', 'status.html');
    if (fs.existsSync(statusFilePath)) res.sendFile(statusFilePath);
    else res.status(404).send('Plik strony statusu nie został znaleziony.');
});

router.get('/checks', (req, res) => {
    const statusFilePath = path.join(process.cwd(), 'status_page', 'checks.html');
    if (fs.existsSync(statusFilePath)) res.sendFile(statusFilePath);
    else res.status(404).send('Plik strony statusu nie został znaleziony.');
});

module.exports = router;