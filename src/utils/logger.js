const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logDir = config.LOG_FILE_PATH;
if (config.LOG_FILE_ENABLED && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
    const moduleTag = module ? `[${module.toUpperCase()}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [VLR]${moduleTag} ${level}: ${message}${metaStr}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: fileFormat,
  defaultMeta: { service: 'valorank' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: config.NODE_ENV === 'production' ? 'warn' : 'debug'
    })
  ]
});

// Add file transports if enabled
if (config.LOG_FILE_ENABLED) {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  }));
}

// In-memory log buffer for real-time access
let logsBuffer = [];
const MAX_LOGS = config.MAX_LOG_ENTRIES;

/**
 * Add log entry to buffer
 */
const addToBuffer = (level, module, message, meta = {}) => {
  const logEntry = {
    id: Date.now() + Math.random(), // Unique ID
    timestamp: new Date().toISOString(),
    level,
    module: module ? module.toUpperCase() : 'SYSTEM',
    message,
    meta,
    iso_timestamp: new Date().toISOString()
  };

  logsBuffer.unshift(logEntry);
  
  // Maintain buffer size
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer = logsBuffer.slice(0, MAX_LOGS);
  }

  return logEntry;
};

/**
 * Enhanced logger with buffer support
 */
const log = {
  /**
   * Log info message
   */
  info: (module, message, meta = {}) => {
    logger.info(message, { module, ...meta });
    return addToBuffer('info', module, message, meta);
  },
  
  /**
   * Log warning message
   */
  warn: (module, message, meta = {}) => {
    logger.warn(message, { module, ...meta });
    return addToBuffer('warn', module, message, meta);
  },
  
  /**
   * Log error message
   */
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
  
  /**
   * Log debug message
   */
  debug: (module, message, meta = {}) => {
    logger.debug(message, { module, ...meta });
    return addToBuffer('debug', module, message, meta);
  },

  /**
   * Get all logs from buffer
   */
  getAllLogs: (limit = null) => {
    const logs = [...logsBuffer];
    return limit ? logs.slice(0, limit) : logs;
  },

  /**
   * Get logs by level
   */
  getLogsByLevel: (level, limit = null) => {
    const filteredLogs = logsBuffer.filter(log => log.level === level);
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  /**
   * Get logs by module
   */
  getLogsByModule: (module, limit = null) => {
    const filteredLogs = logsBuffer.filter(log => log.module === module.toUpperCase());
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  /**
   * Search logs
   */
  searchLogs: (query, limit = null) => {
    const lowerQuery = query.toLowerCase();
    const filteredLogs = logsBuffer.filter(log => 
      log.message.toLowerCase().includes(lowerQuery) ||
      log.module.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(log.meta).toLowerCase().includes(lowerQuery)
    );
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  /**
   * Clear logs buffer
   */
  clearLogs: () => {
    logsBuffer = [];
    log.info('LOGGER', 'Logs buffer cleared by administrator');
    return true;
  },

  /**
   * Get log statistics
   */
  getStats: () => {
    const stats = logsBuffer.reduce((acc, log) => {
      acc.total++;
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, { total: 0, info: 0, warn: 0, error: 0, debug: 0 });
    
    // Add memory usage
    stats.memory = process.memoryUsage();
    stats.uptime = process.uptime();
    stats.bufferSize = logsBuffer.length;
    stats.maxBufferSize = MAX_LOGS;
    
    return stats;
  },

  /**
   * Get logs filtered by time range
   */
  getLogsByTimeRange: (startTime, endTime, limit = null) => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    const filteredLogs = logsBuffer.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= start && logTime <= end;
    });
    
    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  },

  /**
   * Export logs to file
   */
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

  /**
   * Get recent errors
   */
  getRecentErrors: (limit = 50) => {
    return logsBuffer
      .filter(log => log.level === 'error')
      .slice(0, limit);
  },

  /**
   * Get performance metrics
   */
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
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('PROCESS', 'Uncaught Exception', error);
  // Give logger time to write the error
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('PROCESS', 'Unhandled Rejection', new Error(reason), { promise: promise.toString() });
});

module.exports = log;