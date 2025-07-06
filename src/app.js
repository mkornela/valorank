const express = require('express');
const path = require('path');
const fs = require('fs');
const valorantRoutes = require('./routes/valorantRoutes');
const { logToDiscord } = require('./utils/discord');
// Nie potrzebujemy już importować apiEndpoints ani config/docs
// const apiEndpoints = require('./config/docs'); 

const app = express();

app.set('view engine', 'ejs'); // EJS może zostać, jeśli inne części go używają
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

module.exports = app;