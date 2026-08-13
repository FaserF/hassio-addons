import { registerSessionRoutes } from './session.js';
import { registerMessagingRoutes } from './messaging.js';
import { registerContactRoutes } from './contacts.js';
import { registerGroupRoutes } from './groups.js';
import { registerChannelRoutes } from './channels.js';
import { registerSystemRoutes } from './system.js';
import { registerUiApiRoutes } from './ui_api.js';
import { registerModerationRoutes } from './moderation.js';
import { registerTelegramRoutes } from './telegram.js';

import authRouter from './auth.js';

export function registerAPIRoutes(app) {
  app.use('/api/auth', authRouter);
  registerSessionRoutes(app);
  registerMessagingRoutes(app);
  registerContactRoutes(app);
  registerGroupRoutes(app);
  registerChannelRoutes(app);
  registerSystemRoutes(app);
  registerUiApiRoutes(app);
  registerModerationRoutes(app);
  registerTelegramRoutes(app);
}
