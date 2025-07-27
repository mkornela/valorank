require('dotenv').config();

const cron = require('node-cron');
const app = require('./src/app');
const config = require('./src/config');
const log = require('./src/utils/logger');
const { logToDiscord } = require('./src/utils/discord');
const { generateAndSaveStats } = require('./scripts/statsGenerator');
const { initFetch } = require('./src/services/api');

async function startServer() {
    try {
        config.validateConfig();
        await initFetch();

        app.listen(config.PORT, () => {
            log.info('SERVER', `VALORANT Stats API running on http://localhost:${config.PORT}`);
            if (config.DISCORD_WEBHOOK_URL) {
                log.info('SERVER', 'Discord logging is enabled.');
                logToDiscord({ 
                    title: 'Server Started', 
                    color: 0x00FF00, 
                    description: `Server is online on port ${config.PORT}.`, 
                    timestamp: new Date().toISOString() 
                });
            }

            //log.info('SERVER', 'Running initial stats generation on startup...');
            //generateAndSaveStats().catch(err => {
            //     log.error('SERVER', 'Initial stats generation failed.', err);
            //     logToDiscord({ title: 'Critical Error: Initial Stats Generation', color: 0xFF0000, description: `\`\`\`${err.message}\`\`\``, timestamp: new Date().toISOString() }, true);
            //});
            
            //cron.schedule('15 8 * * *', () => {
            //    log.info('CRON', 'Running scheduled daily stats generation...');
            //    logToDiscord({ title: 'Process: Scheduled Stats Generation', color: 0x00FFFF, description: 'Starting daily stats refresh.', timestamp: new Date().toISOString() });
            //    generateAndSaveStats().catch(err => {
            //        log.error('CRON', 'Scheduled stats generation failed.', err);
            //        logToDiscord({ title: 'Error: Scheduled Stats Generation', color: 0xFF0000, description: `\`\`\`${err.message}\`\`\``, timestamp: new Date().toISOString() }, true);
            //    });
            //}, {
            //    scheduled: true,
            //    timezone: "Europe/Warsaw"
            //});
            //log.info('CRON', 'Scheduled daily stats generation for 08:15 (Europe/Warsaw).');
        });

    } catch (error) {
        log.error("SERVER", "FATAL: Failed to start server.", error);
        process.exit(1);
    }
}

startServer();