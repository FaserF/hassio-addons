import { registerSessionRoutes } from './session.js';
import { registerMessagingRoutes } from './messaging.js';
import { registerContactRoutes } from './contacts.js';
import { registerGroupRoutes } from './groups.js';
import { registerChannelRoutes } from './channels.js';
import { registerSystemRoutes } from './system.js';
import { registerUiApiRoutes } from './ui_api.js';
import { registerModerationRoutes } from './moderation.js';

export function registerAPIRoutes(app) {
  registerSessionRoutes(app);
  registerMessagingRoutes(app);
  registerContactRoutes(app);
  registerGroupRoutes(app);
  registerChannelRoutes(app);
  registerSystemRoutes(app);
  registerUiApiRoutes(app);
  registerModerationRoutes(app);
}
