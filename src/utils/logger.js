const winston = require('winston');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const config = require('../config');

class LogEmitter extends EventEmitter {}
const logEmitter = new LogEmitter();

const logDir = config.LOG_FILE_PATH;
if (config.LOG_FILE_ENABLED && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
    const moduleTag = module ? `[${module.toUpperCase()}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [VLR]${moduleTag} ${level}: ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: fileFormat,
  defaultMeta: { service: 'valorank' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: config.NODE_ENV === 'production' ? 'warn' : 'debug'
    })
  ]
});

if (config.LOG_FILE_ENABLED) {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880,
    maxFiles: 5,
    tailable: true
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880,
    maxFiles: 5,
    tailable: true
  }));
}

let logsBuffer = [];
const MAX_LOGS = config.MAX_LOG_ENTRIES;

const addToBuffer = (level, module, message, meta = {}) => {
  const logEntry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    level,
    module: module ? module.toUpperCase() : 'SYSTEM',
    message,
    meta,
    iso_timestamp: new Date().toISOString()
  };

  logsBuffer.unshift(logEntry);
  
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer = logsBuffer.slice(0, MAX_LOGS);
  }

  logEmitter.emit('newLog', logEntry);
  return logEntry;
};

const log = {
  info: (module, message, meta = {}) => {
    logger.info(message, { module, ...meta });
    return addToBuffer('info', module, message, meta);
  },
  
  warn: (module, message, meta = {}) => {
    logger.warn(message, { module, ...meta });
    return addToBuffer('warn', module, message, meta);
  },
  
  error: (module, message, error = null, meta = {}) => {
    const errorMeta = {
      ...meta,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      })
    };
    
    logger.error(message, { module, ...errorMeta });
    return addToBuffer('error', module, message, errorMeta);
  },
  
  debug: (module, message, meta = {}) => {
    logger.debug(message, { module, ...meta });
    return addToBuffer('debug', module, message, meta);
  },

  getAllLogs: (limit = null) => {
    const logs = [...logsBuffer];
    return limit ? logs.slice(0, limit) : logs;
  },

  getLogsByLevel: (level, limit = null) => {
    const filteredLogs = logsBuffer.filter(log => log.level === level);
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  getLogsByModule: (module, limit = null) => {
    const filteredLogs = logsBuffer.filter(log => log.module === module.toUpperCase());
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  searchLogs: (query, limit = null) => {
    const lowerQuery = query.toLowerCase();
    const filteredLogs = logsBuffer.filter(log => 
      log.message.toLowerCase().includes(lowerQuery) ||
      log.module.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(log.meta).toLowerCase().includes(lowerQuery)
    );
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  clearLogs: () => {
    logsBuffer = [];
    log.info('LOGGER', 'Logs buffer cleared by administrator');
    return true;
  },

  getStats: () => {
    const stats = logsBuffer.reduce((acc, log) => {
      acc.total++;
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, { total: 0, info: 0, warn: 0, error: 0, debug: 0 });
    
    stats.memory = process.memoryUsage();
    stats.uptime = process.uptime();
    stats.bufferSize = logsBuffer.length;
    stats.maxBufferSize = MAX_LOGS;
    
    return stats;
  },

  getLogsByTimeRange: (startTime, endTime, limit = null) => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    const filteredLogs = logsBuffer.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= start && logTime <= end;
    });
    
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  exportLogs: (filename = null) => {
    const exportFilename = filename || `valorank-logs-${new Date().toISOString().split('T')[0]}.json`;
    const exportPath = path.join(logDir, exportFilename);
    
    try {
      fs.writeFileSync(exportPath, JSON.stringify(logsBuffer, null, 2));
      log.info('LOGGER', `Logs exported to ${exportFilename}`);
      return { success: true, filename: exportFilename, path: exportPath };
    } catch (error) {
      log.error('LOGGER', 'Failed to export logs', error);
      return { success: false, error: error.message };
    }
  },

  getRecentErrors: (limit = 50) => {
    return logsBuffer
      .filter(log => log.level === 'error')
      .slice(0, limit);
  },

  getPerformanceMetrics: () => {
    const metrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      logCount: logsBuffer.length,
      errorRate: 0
    };
    
    if (logsBuffer.length > 0) {
      const errorCount = logsBuffer.filter(log => log.level === 'error').length;
      metrics.errorRate = (errorCount / logsBuffer.length) * 100;
    }
    
    return metrics;
  },

  onNewLog: (listener) => {
    logEmitter.on('newLog', listener);
  },
  
  removeLogListener: (listener) => {
    logEmitter.off('newLog', listener);
  }
};

process.on('uncaughtException', (error) => {
  log.error('PROCESS', 'Uncaught Exception', error);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('PROCESS', 'Unhandled Rejection', new Error(reason), { promise: promise.toString() });
});

module.exports = log;