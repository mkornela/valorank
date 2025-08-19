const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const valorantRoutes = require('./routes/valorantRoutes');
const appRoutes = require('./routes/appRoutes');
const adminRoutes = require('./routes/adminRoutes');
const config = require('./config/index');
const log = require('./utils/logger');
const { logToDiscord } = require('./utils/discord');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'status_page')));
app.use(express.static(path.join(__dirname, '..', 'admin')));
app.enable('trust proxy');

app.use('/', appRoutes);
app.use('/', valorantRoutes);
app.use('/admin', adminRoutes);

const HISTORY_PATH = path.join(process.cwd(), 'status_history');

async function checkYourApiHealth() {
    try {
        const response = await fetch(`https://api.valo.lol/health`); 
        return { reachable: response.ok };
    } catch (error) {
        log.error('STATUS_CHECK', 'Błąd podczas sprawdzania własnego API health', error);
        return { reachable: false };
    }
}

async function recordApiStatus() {
    try {
        await fs.mkdir(HISTORY_PATH, { recursive: true });
        const health = await checkYourApiHealth();
        const status = health.reachable ? 'operational' : 'error';
        
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        const timeString = now.toTimeString().split(' ')[0].substring(0, 5);

        const filePath = path.join(HISTORY_PATH, `${dateString}.json`);
        let dayData = {};

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            dayData = JSON.parse(fileContent);
        } catch (error) {
            // File doesnt exist, it will be created
        }
        
        dayData[timeString] = { status };
        await fs.writeFile(filePath, JSON.stringify(dayData, null, 2));
        log.info('STATUS_RECORDER', `Zapisano status: ${status} dla ${dateString} o ${timeString}`);

    } catch (error) {
        log.error('STATUS_RECORDER', 'Krytyczny błąd podczas zapisu statusu', error);
    }
}

recordApiStatus();
setInterval(recordApiStatus, 60 * 1000);

app.use((err, req, res, next) => {
    log.error('FATAL', `Unhandled error on ${req.method} ${req.originalUrl}`, err);
    logToDiscord({
        title: '🔴 Krytyczny Błąd Serwera',
        color: 0xFF0000,
        description: `Wystąpił nieobsłużony błąd.`,
        fields: [
            { name: 'Endpoint', value: `\`${req.method} ${req.originalUrl}\`` },
            { name: 'Błąd', value: `\`\`\`${err.message}\`\`\`` }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `IP: ${req.ip}` }
    }, true);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Wystąpił wewnętrzny błąd serwera.', details: err });
});

module.exports = app;