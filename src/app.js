const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const valorantRoutes = require('./routes/valorantRoutes');
const appRoutes = require('./routes/appRoutes');
const adminRoutes = require('./routes/adminRoutes');
const config = require('./config/index');
const log = require('./utils/logger');
const { logToDiscord } = require('./utils/discord');

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const app = express();

const adminHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

const mainHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    adminHelmet(req, res, next);
  } else {
    mainHelmet(req, res, next);
  }
});

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '900'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    error: 'Rate limit exceeded for this endpoint. Please try again later.',
    retryAfter: '3600'
  }
});
app.use('/rank/', strictLimiter);

app.use(session({
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'status_page')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.use((req, res, next) => {
  log.info('REQUEST', `${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

app.get('/health', (req, res) => {
  let version = 'unknown';
  try {
    version = require('../../../package.json').version;
  } catch (error) {
    version = 'unknown';
  }
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version,
    environment: process.env.NODE_ENV || 'development'
  };
  res.json(health);
});

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Valorank API',
      version: '1.0.0',
      description: 'VALORANT statistics API with enhanced security and performance',
      contact: {
        name: 'Valorank Support',
        email: 'support@valo.lol'
      }
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:7312',
        description: 'Development server'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use('/', appRoutes);
app.use('/', valorantRoutes);
app.use('/admin', adminRoutes);

const HISTORY_PATH = path.join(process.cwd(), 'status_history');

async function checkYourApiHealth() {
    try {
        const response = await fetch(`https://api.valo.lol/health`, { 
            timeout: 10000 
        }); 
        return { reachable: response.ok, responseTime: Date.now() };
    } catch (error) {
        log.error('STATUS_CHECK', 'Error checking own API health', error);
        return { reachable: false, error: error.message };
    }
}

async function recordApiStatus() {
    try {
        await fs.mkdir(HISTORY_PATH, { recursive: true });
        const health = await checkYourApiHealth();
        const status = health.reachable ? 'operational' : 'error';
        
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        const timeString = now.toTimeString().split(' ')[0].substring(0, 5);

        const filePath = path.join(HISTORY_PATH, `${dateString}.json`);
        let dayData = {};

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            dayData = JSON.parse(fileContent);
        } catch (error) {
        }
        
        dayData[timeString] = { 
            status,
            responseTime: health.responseTime,
            timestamp: now.toISOString()
        };
        
        await fs.writeFile(filePath, JSON.stringify(dayData, null, 2));
        log.info('STATUS_RECORDER', `Recorded status: ${status} for ${dateString} at ${timeString}`);

    } catch (error) {
        log.error('STATUS_RECORDER', 'Critical error during status recording', error);
        logToDiscord({
            title: '🔴 Status Recording Error',
            color: 0xFF0000,
            description: `Failed to record API status.`,
            fields: [
                { name: 'Error', value: `\`\`\`${error.message}\`\`\`` }
            ],
            timestamp: new Date().toISOString()
        }, true);
    }
}

recordApiStatus();
setInterval(recordApiStatus, 60 * 1000);

app.use((req, res) => {
    log.warn('NOT_FOUND', `${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.originalUrl} does not exist`,
        documentation: '/api-docs'
    });
});

app.use((err, req, res, next) => {
    log.error('FATAL', `Unhandled error on ${req.method} ${req.originalUrl}`, err);
    
    logToDiscord({
        title: '🔴 Critical Server Error',
        color: 0xFF0000,
        description: `An unhandled error occurred.`,
        fields: [
            { name: 'Endpoint', value: `\`${req.method} ${req.originalUrl}\`` },
            { name: 'Error', value: `\`\`\`${err.message}\`\`\`` },
            { name: 'Stack', value: `\`\`\`${err.stack?.substring(0, 1000)}...\`\`\`` }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `IP: ${req.ip}` }
    }, true);
    
    if (res.headersSent) return next(err);
    
    const errorResponse = {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString()
    };
    
    res.status(500).json(errorResponse);
});

process.on('SIGTERM', () => {
    log.info('SHUTDOWN', 'SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    log.info('SHUTDOWN', 'SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;