import { rateLimit } from 'express-rate-limit';
import { logger } from './logger.js';
import { UI_AUTH_ENABLED, UI_AUTH_PASSWORD, API_TOKEN } from './config.js';
import { getSession, addLog } from './session.js';
import { SYSTEM_STATE, saveSystemState } from './state.js';

export const ipFilterMiddleware = (req, res, next) => {
  // If UI Auth is enabled, we don't need IP filtering
  if (UI_AUTH_ENABLED) return next();

  // Always allow Ingress
  if (req.headers['x-ingress-path']) return next();

  let ip = req.ip || req.socket?.remoteAddress;
  if (ip.startsWith('::ffff:')) ip = ip.substr(7);

  const isPrivate =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    /^(10)\.|^(172\.(1[6-9]|2[0-9]|3[0-1]))\.|^(192\.168)\.|^fc[0-9a-f]{2}:|^fe80:/.test(ip);

  if (!isPrivate) {
    addLog(
      getSession('default'),
      `Blocked external access attempt from ${ip} (UI Auth Disabled)`,
      'warning'
    );
    logger.warn(
      { ip, headers: req.headers },
      '[SECURITY] Blocked external access attempt while UI Auth is disabled'
    );
    return res
      .status(403)
      .send(
        'Forbidden: External access is disabled when UI Authentication is off. Enable UI Auth or use Ingress.'
      );
  }

  return next();
};

export const authMiddleware = (req, res, next) => {
  const providedToken = req.header('X-Auth-Token');

  if (!providedToken) {
    logger.warn({ ip: req.ip, path: req.originalUrl }, '[AUTH] Missing X-Auth-Token in request');
    return res.status(401).json({ error: 'Unauthorized', detail: 'Missing X-Auth-Token' });
  }

  if (providedToken !== API_TOKEN) {
    logger.warn(
      {
        ip: req.ip,
        path: req.originalUrl,
        match: false,
        tokenPrefix: providedToken.substring(0, 4) + '...',
      },
      '[AUTH] Token mismatch. The provided token does not match the current API_TOKEN. Check addon logs for the current token.'
    );
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid X-Auth-Token' });
  }

  // Valid token provided - update "Active Interest" for discovery logic
  SYSTEM_STATE.last_integration_online = Date.now();
  saveSystemState();

  next();
};

export const anyAuthMiddleware = (req, res, next) => {
  const providedToken = req.header('X-Auth-Token');
  if (providedToken) {
    if (providedToken === API_TOKEN) {
      SYSTEM_STATE.last_integration_online = Date.now();
      saveSystemState();
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid X-Auth-Token' });
  }

  return uiAuthMiddleware(req, res, next);
};

export const uiAuthMiddleware = (req, res, next) => {
  // Always skip if Ingress is used (Home Assistant handles auth)
  if (req.headers['x-ingress-path']) return next();

  if (!UI_AUTH_ENABLED) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Addon"');
    return res.status(401).send('Unauthorized');
  }

  let user = '';
  let pass = '';
  try {
    const auth = Buffer.from(authHeader.split(' ')[1] || '', 'base64')
      .toString()
      .split(':');
    user = auth[0] || '';
    pass = auth[1] || '';
  } catch (err) {}

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

export const httpLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url } = req;
  const ip = req.ip || req.socket?.remoteAddress;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    if (statusCode >= 400) {
      logger.warn(
        { method, url, statusCode, duration, ip },
        `🌐 HTTP ${method} ${url} ${statusCode} (${duration}ms)`
      );
    } else {
      logger.debug(
        { method, url, statusCode, duration, ip },
        `🌐 HTTP ${method} ${url} ${statusCode} (${duration}ms)`
      );
    }
  });

  next();
};

const isPrivateIP = (ip) => {
  if (!ip) return false;
  let cleanIp = ip;
  if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.substr(7);
  return (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    /^(10)\.|^(172\.(1[6-9]|2[0-9]|3[0-1]))\.|^(192\.168)\.|^fc[0-9a-f]{2}:|^fe80:/.test(cleanIp)
  );
};

export const uiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased buffer for dashboard polling and multiple tabs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isPrivateIP(req.ip || req.socket?.remoteAddress),
  validate: { trustProxy: false },
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300, // Increased for frequent HA updates and media bursts
  message: 'Too many API requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isPrivateIP(req.ip || req.socket?.remoteAddress),
  validate: { trustProxy: false },
});
