import express from 'express';
import { registerAPIRoutes } from './api.js';
import { registerUIRoutes } from './ui.js';
import { apiLimiter, uiLimiter, ipFilterMiddleware } from '../middleware.js';
import { MEDIA_DIR } from '../config.js';

export function registerRoutes(app) {
  app.use('/media', express.static(MEDIA_DIR));

  // Apply limiters to route groups
  app.use('/session', apiLimiter);
  app.use('/qr', apiLimiter);
  app.use('/status', apiLimiter);
  app.use('/health', apiLimiter);
  app.use('/events', apiLimiter);
  app.use('/stats', apiLimiter);
  app.use('/send_', apiLimiter); // Matches send_message, send_image, etc.
  app.use('/revoke_message', apiLimiter);
  app.use('/edit_message', apiLimiter);
  app.use('/set_presence', apiLimiter);
  app.use('/groups', apiLimiter);
  app.use('/chats', apiLimiter);
  app.use('/mark_as_read', apiLimiter);
  app.use('/logs', apiLimiter);
  app.use('/api', apiLimiter);

  registerAPIRoutes(app);

  // Root UI - Apply limiter and IP filter to UI routes
  app.get('/', uiLimiter, ipFilterMiddleware);
  registerUIRoutes(app);
}
