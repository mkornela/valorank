const express = require('express');
const path = require('path');
const fs = require('fs');
const { logToDiscord } = require('../utils/discord');
const log = require('../utils/logger');
const { checkApiStatus } = require('../services/api'); // <-- Dodany import

const router = express.Router();

router.get('/', (req, res) => {
    const docsFilePath = path.join(process.cwd(), 'docs.html');
    if (fs.existsSync(docsFilePath)) {
        res.sendFile(docsFilePath);
    } else {
        res.status(404).send('Plik dokumentacji nie został znaleziony. Uruchom `npm run docs`, aby go wygenerować.');
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

router.get('/status', (req, res) => {
    const statusFilePath = path.join(process.cwd(), 'status_page', 'status.html');
    if (fs.existsSync(statusFilePath)) {
        res.sendFile(statusFilePath);
    } else {
        res.status(404).send('Plik strony statusu nie został znaleziony.');
    }
});


module.exports = router;