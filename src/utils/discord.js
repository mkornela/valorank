const config = require('../config');
const log = require('./logger');

async function logToDiscord(embed, pingOnError = false) {
    if (!config.DISCORD_WEBHOOK_URL) {
        return; 
    }

    const payload = {
        embeds: [embed]
    };
    
    if (pingOnError && config.DISCORD_USER_ID_ON_ERROR) {
        payload.content = `<@${config.DISCORD_USER_ID_ON_ERROR}>`;
    }

    try {
        const fetch = await import('node-fetch').then(module => module.default);
        await fetch(config.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        log.error('DISCORD', 'Failed to send log to Discord webhook.', error);
    }
}

module.exports = { logToDiscord };