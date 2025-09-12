const path = require('path');
const fs = require('fs');

class PathSecurity {
    static validateAndResolvePath(basePath, userInput, allowedExtensions = []) {
        if (!userInput || typeof userInput !== 'string') {
            throw new Error('Invalid input path');
        }

        const normalizedInput = userInput.replace(/\.\./g, '').replace(/\\/g, '/').replace(/\/+/g, '/');
        
        if (normalizedInput.includes('../') || normalizedInput.startsWith('/') || normalizedInput.includes(':')) {
            throw new Error('Path traversal attempt detected');
        }

        const resolvedPath = path.resolve(basePath, normalizedInput);
        
        if (!resolvedPath.startsWith(basePath)) {
            throw new Error('Path resolution outside base directory');
        }

        if (allowedExtensions.length > 0) {
            const ext = path.extname(resolvedPath).toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                throw new Error('Invalid file extension');
            }
        }

        return resolvedPath;
    }

    static validateAndResolveStaticPath(basePath, userInput) {
        return this.validateAndResolvePath(basePath, userInput, ['.html', '.txt', '.css', '.js', '.json']);
    }

    static safeReadFile(filePath, basePath, encoding = 'utf-8') {
        const safePath = this.validateAndResolvePath(basePath, filePath, ['.json']);
        return fs.promises.readFile(safePath, encoding);
    }

    static safeSendFile(res, filePath, basePath) {
        try {
            const safePath = this.validateAndResolveStaticPath(basePath, filePath);
            if (fs.existsSync(safePath)) {
                res.sendFile(safePath);
            } else {
                res.status(404).json({ error: 'File not found' });
            }
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static isValidDateString(dateString) {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    }

    static isValidFileName(fileName) {
        return /^[a-zA-Z0-9_\-\.]+$/.test(fileName) && !fileName.includes('..');
    }
}

module.exports = PathSecurity;