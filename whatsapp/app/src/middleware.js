import { rateLimit } from 'express-rate-limit';
import { logger } from './logger.js';
import { UI_AUTH_ENABLED, UI_AUTH_PASSWORD, API_TOKEN } from './config.js';
import { getSession, addLog } from './session.js';
import { SYSTEM_STATE, saveSystemState } from './state.js';

import { determineUserRole, isPrivateIP } from './rbac.js';

export const rbacMiddleware = (req, res, next) => {
  const userRole = determineUserRole(req);
  req.userRole = userRole;
  next();
};

export const ipFilterMiddleware = (req, res, next) => {
  const userRole = req.userRole || determineUserRole(req);
  req.userRole = userRole;

  // Always allow Ingress
  if (userRole.isIngress) return next();

  // If UI Auth password is specified, allow request to proceed to Basic Auth / 2FA check
  if (UI_AUTH_ENABLED || UI_AUTH_PASSWORD) return next();

  // Local private IP is allowed auto superadmin when no password set
  if (userRole.authMethod === 'local_trusted') return next();

  // If user has valid 2FA session token, allow
  if (userRole.role !== 'unauthenticated') return next();

  let ip = req.ip || req.socket?.remoteAddress;
  if (ip.startsWith('::ffff:')) ip = ip.substr(7);

  addLog(
    getSession('default'),
    `Blocked external access attempt from ${ip} (Unauthenticated)`,
    'warning'
  );
  logger.warn(
    { ip, headers: req.headers },
    '[SECURITY] Blocked external unauthenticated access attempt'
  );
  
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', redirect: '/login' });
  }
  return res.redirect('/login');
};

export const uiAuthMiddleware = (req, res, next) => {
  const userRole = req.userRole || determineUserRole(req);
  req.userRole = userRole;

  // Skip auth checks for Ingress
  if (userRole.isIngress) return next();

  // Local private IP without password -> trusted superadmin
  if (userRole.authMethod === 'local_trusted') return next();

  // Active 2FA session -> allowed
  if (userRole.role !== 'unauthenticated') return next();

  // Basic auth check if password configured
  if (UI_AUTH_ENABLED || UI_AUTH_PASSWORD) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
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
        req.userRole = {
          role: 'superadmin',
          isSuperAdmin: true,
          isIngress: false,
          authMethod: 'basic_auth',
          phone: null,
        };
        return next();
      }
    }
  }

  // Not authenticated -> Redirect to WhatsApp Login UI page or return 401
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', redirect: '/login' });
  }
  return res.redirect('/login');
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
    if (statusCode >= 500) {
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
