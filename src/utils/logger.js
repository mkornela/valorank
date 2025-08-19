const p = require('picocolors');
const dayjs = require('dayjs');
const EventEmitter = require('events');

const logEmitter = new EventEmitter();

let logsBuffer = [];
const MAX_LOGS = 1000;

const formatMessage = (level, module, message) => {
    const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
    return `${p.gray(`[${timestamp}]`)}${p.cyan('[VLR]')}${p.magenta(`[${module}]`)} ${level} ${message}`;
};

const addToBuffer = (level, module, message, error = null) => {
    const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
    const logEntry = {
        id: Date.now() + Math.random(), // Unique ID
        timestamp,
        level,
        module: module.toUpperCase(),
        message,
        error: error ? {
            message: error.message,
            stack: error.stack
        } : null,
        iso_timestamp: new Date().toISOString()
    };

    logsBuffer.unshift(logEntry);
    
    if (logsBuffer.length > MAX_LOGS) {
        logsBuffer = logsBuffer.slice(0, MAX_LOGS);
    }

    logEmitter.emit('newLog', logEntry);

    return logEntry;
};

/*const sendToErrorEndpoint = async (module, message, error = null) => {
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
};*/

const log = {
    info: (module, message) => {
        console.log(formatMessage(p.blue('INFO'), module.toUpperCase(), message));
        addToBuffer('info', module, message);
    },
    
    warn: (module, message) => {
        console.warn(formatMessage(p.yellow('WARN'), module.toUpperCase(), message));
        addToBuffer('warn', module, message);
    },
    
    error: (module, message, error = null) => {
        let errorMessage = message;
        if (error) {
            errorMessage += `\n${error.stack || error.message}`;
        }
        console.error(formatMessage(p.red('ERROR'), module.toUpperCase(), errorMessage));
        addToBuffer('error', module, errorMessage, error);
        
        //sendToErrorEndpoint(module, message, error).catch(() => {});
    },

    debug: (module, message) => {
        console.debug(formatMessage(p.gray('DEBUG'), module.toUpperCase(), message));
        addToBuffer('debug', module, message);
    },

    getAllLogs: () => {
        return [...logsBuffer];
    },

    getLogsByLevel: (level) => {
        return logsBuffer.filter(log => log.level === level);
    },

    getLogsByModule: (module) => {
        return logsBuffer.filter(log => log.module === module.toUpperCase());
    },

    searchLogs: (query) => {
        const lowerQuery = query.toLowerCase();
        return logsBuffer.filter(log => 
            log.message.toLowerCase().includes(lowerQuery) ||
            log.module.toLowerCase().includes(lowerQuery)
        );
    },

    clearLogs: () => {
        logsBuffer = [];
        log.info('LOGGER', 'Logs buffer cleared by administrator');
    },

    getStats: () => {
        const stats = logsBuffer.reduce((acc, log) => {
            acc.total++;
            acc[log.level] = (acc[log.level] || 0) + 1;
            return acc;
        }, { total: 0, info: 0, warn: 0, error: 0, debug: 0 });
        
        return stats;
    },

    onNewLog: (callback) => {
        logEmitter.on('newLog', callback);
    },

    removeLogListener: (callback) => {
        logEmitter.removeListener('newLog', callback);
    }
};

module.exports = log;