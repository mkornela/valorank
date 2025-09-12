const express = require('express');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logger');

const router = express.Router();

router.get('/', requireAdminAuth, (req, res) => {
    res.json({ 
        message: 'Admin panel is working!', 
        timestamp: new Date().toISOString(),
        routes: [
            'GET /admin/logs - Logs viewer page',
            'GET /admin/logs/stream - Real-time logs stream',
            'GET /admin/logs/api - Logs API endpoint',
            'DELETE /admin/logs - Clear logs',
            'GET /admin/test - Test endpoint'
        ]
    });
});

router.get('/test', requireAdminAuth, (req, res) => {
    log.info('ADMIN', `Admin test endpoint accessed from IP: ${req.ip}`);
    res.json({ 
        success: true, 
        message: 'Admin routes are working correctly!',
        timestamp: new Date().toISOString()
    });
});

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');
        
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (username === adminUsername && password === adminPassword) {
            return next();
        }
    }
    
    log.warn('ADMIN', `Failed admin access attempt from IP: ${req.ip}`);
    res.setHeader('WWW-Authenticate', 'Basic realm="Valorank Admin"');
    res.status(401).json({ error: 'Authentication required' });
}

router.get('/logs', requireAdminAuth, (req, res) => {
    const logsPagePath = path.join(__dirname, '..', '..', 'admin', 'index.html');
    
    if (fs.existsSync(logsPagePath)) {
        res.sendFile(logsPagePath);
    } else {
        res.status(404).json({ error: 'Admin panel not found' });
    }
});

router.get('/logs/stream', requireAdminAuth, (req, res) => {
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

router.get('/logs/api', requireAdminAuth, (req, res) => {
    try {
        if (typeof log.getAllLogs !== 'function') {
            return res.status(500).json({
                error: 'Logger not properly configured. Please update utils/logger.js'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filter = req.query.filter || 'all';
        const search = req.query.search || '';
        const sortField = req.query.sort || 'timestamp';
        const sortOrder = req.query.order || 'desc';

        let logs = log.getAllLogs();

        if (filter !== 'all') {
            logs = logs.filter(log => log.level === filter);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            logs = logs.filter(log => 
                log.message.toLowerCase().includes(searchLower) ||
                log.module.toLowerCase().includes(searchLower) ||
                (log.id && log.id.toString().includes(searchLower)) ||
                JSON.stringify(log.meta).toLowerCase().includes(searchLower)
            );
        }

        logs.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (sortField === 'timestamp') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        const total = logs.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLogs = logs.slice(startIndex, endIndex);

        const stats = typeof log.getStats === 'function' ? log.getStats() : {
            total: total,
            info: logs.filter(l => l.level === 'info').length,
            warn: logs.filter(l => l.level === 'warn').length,
            error: logs.filter(l => l.level === 'error').length,
            debug: logs.filter(l => l.level === 'debug').length
        };

        res.json({
            logs: paginatedLogs,
            total: total,
            page: page,
            limit: limit,
            totalPages: Math.ceil(total / limit),
            stats: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log.error('ADMIN', 'Error fetching logs via API', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/logs', requireAdminAuth, (req, res) => {
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