/**
 * API Key Authentication Middleware
 * 
 * Security layers:
 * 1. API key required for all /api/* routes
 * 2. Rate limiting to prevent brute force
 * 3. Request logging for audit
 */

const API_KEY = process.env.API_KEY || 'sleep-api-key-change-me-in-production';
const PI_API_KEY = process.env.PI_API_KEY || 'pi-upload-key-change-me';

// Trusted IPs (local network - no auth required)
const TRUSTED_IPS = (process.env.TRUSTED_IPS || '127.0.0.1,::1').split(',');

// Rate limiting store (in-memory, resets on restart)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

/**
 * Check if IP is trusted (local network)
 */
function isTrustedIP(ip) {
    // Normalize IP
    const normalizedIP = ip.replace('::ffff:', '');

    // Check against trusted list
    if (TRUSTED_IPS.includes(normalizedIP)) return true;

    // Allow local network IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    if (normalizedIP.startsWith('10.') ||
        normalizedIP.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalizedIP)) {
        return true;
    }

    return false;
}

/**
 * Rate limiting check
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const key = ip;

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    const entry = rateLimitStore.get(key);

    if (now > entry.resetAt) {
        // Window expired, reset
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
        console.warn(`Rate limit exceeded for ${clientIP}`);
        return res.status(429).json({ error: 'Too many requests' });
    }

    // Skip auth for health check
    if (req.path === '/api/ping' || req.path === '/api/health') {
        return next();
    }

    // Check for API key in header
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;

    // Pi uploads use separate key
    if (req.path.startsWith('/api/audio/upload')) {
        if (providedKey === PI_API_KEY || providedKey === API_KEY) {
            return next();
        }
        // Also allow trusted IPs without key (for Pi on same network)
        if (isTrustedIP(clientIP)) {
            return next();
        }
    }

    // Dashboard/general API access
    if (providedKey === API_KEY) {
        return next();
    }

    // Allow trusted local network IPs without key
    if (isTrustedIP(clientIP)) {
        return next();
    }

    // Unauthorized
    console.warn(`Unauthorized access attempt from ${clientIP}`);
    return res.status(401).json({ error: 'Unauthorized - API key required' });
}

/**
 * Request logging middleware
 */
function logMiddleware(req, res, next) {
    const start = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = `${req.method} ${req.path} ${res.statusCode} ${duration}ms [${clientIP}]`;

        if (res.statusCode >= 400) {
            console.warn(log);
        } else if (process.env.NODE_ENV !== 'production') {
            console.log(log);
        }
    });

    next();
}

module.exports = {
    authMiddleware,
    logMiddleware,
    API_KEY,
    PI_API_KEY
};
