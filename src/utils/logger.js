const p = require('picocolors');
const dayjs = require('dayjs');

const formatMessage = (level, module, message) => {
    const timestamp = dayjs().format('DD/MM/YYYY HH:mm:ss');
    return `${p.gray(`[${timestamp}]`)}${p.cyan('[VLR]')}${p.magenta(`[${module}]`)} ${level} ${message}`;
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
    },
};

module.exports = log;