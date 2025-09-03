const app = require('./src/app');
const config = require('./src/config');
const log = require('./src/utils/logger');

const server = app.listen(config.PORT, () => {
  log.info('SERVER', `Valorank Enhanced server running on port ${config.PORT}`);
  log.info('SERVER', `Environment: ${config.NODE_ENV}`);
  log.info('SERVER', `Health check available at: http://localhost:${config.PORT}/health`);
  log.info('SERVER', `API documentation available at: http://localhost:${config.PORT}/api-docs`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    log.error('SERVER', `Port ${config.PORT} is already in use`);
    process.exit(1);
  } else {
    log.error('SERVER', 'Server error', error);
  }
});

process.on('SIGTERM', () => {
  log.info('SHUTDOWN', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    log.info('SHUTDOWN', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log.info('SHUTDOWN', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    log.info('SHUTDOWN', 'Server closed');
    process.exit(0);
  });
});

module.exports = server;