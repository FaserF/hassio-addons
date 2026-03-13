import { rateLimit } from 'express-rate-limit';
import { logger } from './logger.js';
import { UI_AUTH_ENABLED, UI_AUTH_PASSWORD, API_TOKEN } from './config.js';
import { getSession, addLog } from './session.js';

export const ipFilterMiddleware = (req, res, next) => {
  if (UI_AUTH_ENABLED) return next();

  let ip = req.ip || req.connection.remoteAddress;
  if (ip.startsWith('::ffff:')) ip = ip.substr(7);

  const isPrivate =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    /^(10)\.|^(172\.(1[6-9]|2[0-9]|3[0-1]))\.|^(192\.168)\.|^fc[0-9a-f]{2}:/.test(ip);

  // If IP isn't private, block immediately. No longer trusting ingress headers
  // from public IPs as they can easily be spoofed via standard cURL requests.
  if (!isPrivate) {
    addLog(getSession('default'), `Blocked access attempt from public IP: ${ip}`, 'warning');
    logger.warn(
      { ip, headers: req.headers },
      '[SECURITY] Blocked access attempt (UI Auth Disabled)'
    );
    return res
      .status(403)
      .send('Forbidden: External access is disabled when UI Authentication is off.');
  }

  return next();
};

export const authMiddleware = (req, res, next) => {
  const providedToken = req.header('X-Auth-Token');
  if (providedToken !== API_TOKEN) {
    addLog(getSession('default'), `Unauthorized API access attempt from ${req.ip}`, 'error');
    logger.warn(
      { ip: req.ip, path: req.originalUrl, tokenProvided: !!providedToken },
      '[AUTH] Unauthorized access attempt'
    );
    return res
      .status(401)
      .json({ error: 'Unauthorized', detail: 'Invalid or missing X-Auth-Token' });
  }
  next();
};

export const uiAuthMiddleware = (req, res, next) => {
  if (!UI_AUTH_ENABLED) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Addon"');
    return res.status(401).send('Unauthorized');
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = auth[0];
  const pass = auth[1];

  if (user === 'admin' && pass === UI_AUTH_PASSWORD) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Addon"');
    return res.status(401).send('Unauthorized');
  }
};

export const ingressPrefixMiddleware = (req, res, next) => {
  if (req.url.startsWith('//')) req.url = req.url.replace(/\/+/g, '/');

  const ingressPath = req.headers['x-ingress-path'];
  if (ingressPath) {
    const cleanPrefix = ingressPath.replace(/\/$/, '');
    if (req.url.startsWith(cleanPrefix)) {
      req.url = req.url.substring(cleanPrefix.length);
      if (!req.url.startsWith('/')) req.url = '/' + req.url;
    }
    req.url = req.url.replace(/\/+/g, '/');
  } else {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
};

export const uiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many API requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
});
