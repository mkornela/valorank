const p = require('picocolors');
const dayjs = require('dayjs');

const formatMessage = (level, module, message) => {
    const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
    return `${p.gray(`[${timestamp}]`)}${p.cyan('[VLR]')}${p.magenta(`[${module}]`)} ${level} ${message}`;
};

const sendToErrorEndpoint = async (module, message, error = null) => {
    try {
        const endpoint = 'https://n8n.valo.lol/webhook/valorank-error';
        const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
        
        const payload = {
            module: module.toUpperCase(),
            message: message,
            error: error ? {
                message: error.message,
                stack: error.stack
            } : null,
            timestamp: timestamp,
            iso_timestamp: new Date().toISOString()
        };

        const fetch = await import('node-fetch').then(module => module.default);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Failed to send error to endpoint: ${response.status} ${response.statusText}`);
        }
    } catch (endpointError) {
        console.error('Error endpoint failure:', endpointError.message);
    }
};

const log = {
    info: (module, message) => {
        console.log(formatMessage(p.blue('INFO'), module.toUpperCase(), message));
    },
    warn: (module, message) => {
        console.warn(formatMessage(p.yellow('WARN'), module.toUpperCase(), message));
    },
    error: (module, message, error = null) => {
        let errorMessage = message;
        if (error) {
            errorMessage += `\n${error.stack || error.message}`;
        }
        console.error(formatMessage(p.red('ERROR'), module.toUpperCase(), errorMessage));
        
        sendToErrorEndpoint(module, message, error).catch(() => {});
    },
};

module.exports = log;