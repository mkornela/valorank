const express = require('express');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logger');
const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ 
        message: 'Admin panel is working!', 
        timestamp: new Date().toISOString(),
        routes: [
            'GET /admin/logs - Logs viewer page',
            'POST /admin/login - Login endpoint',
            'GET /admin/logs/stream - Real-time logs stream',
            'GET /admin/test - Test endpoint'
        ]
    });
});

router.get('/test', (req, res) => {
    log.info('ADMIN', `Admin test endpoint accessed from IP: ${req.ip}`);
    res.json({ 
        success: true, 
        message: 'Admin routes are working correctly!',
        timestamp: new Date().toISOString()
    });
});

function requireAdminAuth(req, res, next) {
    const { username, password } = req.body || {};
    
    const adminUsername = config.ADMIN_USERNAME;
    const adminPassword = config.ADMIN_PASSWORD;
    
    if (username === adminUsername && password === adminPassword) {
        next();
    } else {
        log.warn('ADMIN', `Failed login attempt from IP: ${req.ip}, username: ${username}`);
        res.status(401).json({ error: 'Nieprawidłowe dane autoryzacyjne' });
    }
}

router.post('/login', requireAdminAuth, (req, res) => {
    const { username } = req.body;
    
    log.info('ADMIN', `Administrator ${username} logged in from IP: ${req.ip}`);
    
    res.json({ 
        success: true, 
        message: 'Zalogowano pomyślnie',
        timestamp: new Date().toISOString()
    });
});

router.get('/logs', (req, res) => {
    const logsPagePath = path.join(__dirname, '..', 'admin', 'logs.html');
    
    if (fs.existsSync(logsPagePath)) {
        res.sendFile(logsPagePath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admin Logs - Setup Required</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a1a; color: #fff; }
                    .container { max-width: 800px; margin: 0 auto; }
                    .error { background: #ff4444; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .info { background: #4444ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    code { background: #333; padding: 2px 6px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔧 Admin Panel - Setup Required</h1>
                    
                    <div class="error">
                        <h3>❌ Logs page not found</h3>
                        <p>File <code>admin/logs.html</code> doesn't exist.</p>
                    </div>
                    
                    <div class="info">
                        <h3>📁 Required folder structure:</h3>
                        <pre>
your-project/
├── admin/
│   └── logs.html  ← Create this file
├── routes/
│   └── adminRoutes.js  ← This file exists ✓
└── utils/
    └── logger.js  ← Update this file
                        </pre>
                    </div>
                    
                    <div class="info">
                        <h3>🚀 Quick Setup:</h3>
                        <ol>
                            <li>Create folder <code>admin/</code> in your project root</li>
                            <li>Create <code>admin/logs.html</code> with the logs viewer page</li>
                            <li>Update <code>utils/logger.js</code> with the enhanced logger</li>
                            <li>Add to <code>.env</code>:
                                <br><code>ADMIN_USERNAME=your_username</code>
                                <br><code>ADMIN_PASSWORD=your_password</code>
                            </li>
                        </ol>
                    </div>
                    
                    <p><a href="/admin/test" style="color: #4AF;">Test admin routes</a></p>
                    <p><a href="/" style="color: #4AF;">← Back to main page</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

router.get('/logs/stream', (req, res) => {
    if (typeof log.getAllLogs !== 'function') {
        return res.status(500).json({ 
            error: 'Logger not properly configured. Please update utils/logger.js' 
        });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const testLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('pl-PL'),
        level: 'info',
        module: 'ADMIN',
        message: 'Connected to logs stream successfully!'
    };

    res.write(`data: ${JSON.stringify(testLog)}\n\n`);

    let logListener;
    if (typeof log.onNewLog === 'function') {
        logListener = (logEntry) => {
            res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
        };
        log.onNewLog(logListener);
    }

    const pingInterval = setInterval(() => {
        res.write(`event: ping\ndata: ${JSON.stringify({ ping: true, timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    req.on('close', () => {
        clearInterval(pingInterval);
        if (logListener && typeof log.removeLogListener === 'function') {
            log.removeLogListener(logListener);
        }
        log.info('ADMIN', `Administrator disconnected from logs stream (IP: ${req.ip})`);
    });

    log.info('ADMIN', `Administrator connected to logs stream (IP: ${req.ip})`);
});

router.get('/logs/api', (req, res) => {
    try {
        if (typeof log.getAllLogs !== 'function') {
            return res.status(500).json({ 
                error: 'Logger not properly configured. Please update utils/logger.js' 
            });
        }

        const logs = log.getAllLogs();
        const stats = typeof log.getStats === 'function' ? log.getStats() : {
            total: logs.length,
            info: 0,
            warn: 0,
            error: 0
        };

        res.json({
            logs: logs.slice(0, 100),
            stats: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log.error('ADMIN', 'Error fetching logs via API', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/logs', (req, res) => {
    try {
        if (typeof log.clearLogs === 'function') {
            log.clearLogs();
            log.info('ADMIN', `Administrator cleared logs (IP: ${req.ip})`);
            res.json({ success: true, message: 'Logs cleared successfully' });
        } else {
            res.status(500).json({ error: 'Clear logs function not available' });
        }
    } catch (error) {
        log.error('ADMIN', 'Error clearing logs', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;