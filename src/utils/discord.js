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

async function sendLogToDiscord(level, message, logId, metadata = {}, source = 'SYSTEM') {
    if (!config.DISCORD_WEBHOOK_URL) {
        return;
    }

    const colors = {
        error: 0xFF0000,
        warn: 0xFFA500,
        info: 0x00FF00,
        debug: 0x808080
    };

    const color = colors[level] || 0x808080;
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.PORT}`;
    
    const embed = {
        title: `${level.toUpperCase()} Log: ${source}`,
        description: message.length > 2000 ? message.substring(0, 2000) + '...' : message,
        color: color,
        timestamp: new Date().toISOString(),
        url: logId ? `${baseUrl}/admin/logs#log-${logId}` : undefined,
        fields: [
            {
                name: 'Level',
                value: level.toUpperCase(),
                inline: true
            },
            {
                name: 'Source',
                value: source,
                inline: true
            }
        ]
    };

    if (logId) {
        embed.fields.push({
            name: 'Log ID',
            value: logId,
            inline: true
        });
    }

    if (metadata && Object.keys(metadata).length > 0) {
        const metadataStr = JSON.stringify(metadata, null, 2);
        if (metadataStr.length <= 1000) {
            embed.fields.push({
                name: 'Metadata',
                value: `\`\`\`json\n${metadataStr}\n\`\`\``,
                inline: false
            });
        } else {
            embed.fields.push({
                name: 'Metadata',
                value: 'Metadata too large to display',
                inline: false
            });
        }
    }

    const payload = {
        embeds: [embed]
    };

    if (level === 'error' && config.DISCORD_USER_ID_ON_ERROR) {
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

module.exports = { logToDiscord, sendLogToDiscord };