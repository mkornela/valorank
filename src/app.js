const express = require('express');
const path = require('path');
const fs = require('fs');
const valorantRoutes = require('./routes/valorantRoutes');
const { logToDiscord } = require('./utils/discord');
const config = require('./config/index');
const log = require('./utils/logger');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.enable('trust proxy');

app.use('/', valorantRoutes);

// Serwowanie statycznego pliku docs.html
app.get('/', (req, res) => {
    const docsFilePath = path.join(process.cwd(), 'docs.html');
    
    if (fs.existsSync(docsFilePath)) {
        res.sendFile(docsFilePath);
    } else {
        res.status(404).send('Plik dokumentacji nie został znaleziony. Uruchom `npm run docs`, aby go wygenerować.');
    }
});

app.get('/statystyki', (req, res) => {
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

app.get('/display', (req, res) => {
    const docsFilePath = path.join(process.cwd(), 'display.html');
    
    if (fs.existsSync(docsFilePath)) {
        res.sendFile(docsFilePath);
    } else {
        res.status(404).send('Błąd API. Skontaktuj się z administratorem!');
    }
});

app.get('/health', (req, res) => {
    try {
        const healthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version,
            environment: process.env.NODE_ENV || 'development'
        };

        // Sprawdź czy pliki statystyk istnieją
        const statsFilePath = path.join(process.cwd(), 'valorant_stats.html');
        const docsFilePath = path.join(process.cwd(), 'docs.html');
        
        healthStatus.files = {
            stats: fs.existsSync(statsFilePath),
            docs: fs.existsSync(docsFilePath)
        };

        log.info('HEALTH', `Health check passed from ${req.ip}`);
        res.status(200).json(healthStatus);
    } catch (error) {
        log.error('HEALTH', 'Health check failed', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = app;