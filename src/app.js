const express = require('express');
const path = require('path');
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

// Rejestracja routerów
app.use('/', appRoutes);
app.use('/', valorantRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {
    log.error('FATAL', `Unhandled error on ${req.method} ${req.originalUrl}`, err);

    logToDiscord({
        title: '🔴 Krytyczny Błąd Serwera',
        color: 0xFF0000,
        description: `Wystąpił nieobsłużony błąd, który uniemożliwił przetworzenie zapytania.`,
        fields: [
            { name: 'Endpoint', value: `\`${req.method} ${req.originalUrl}\`` },
            { name: 'Błąd', value: `\`\`\`${err.message}\`\`\`` }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `IP: ${req.ip}` }
    }, true);

    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).json({
        error: 'Wystąpił wewnętrzny błąd serwera.'
    });
});

module.exports = app;