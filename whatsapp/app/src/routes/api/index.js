import { registerSessionRoutes } from './session.js';
import { registerMessagingRoutes } from './messaging.js';
import { registerContactRoutes } from './contacts.js';
import { registerSystemRoutes } from './system.js';
import { registerUiApiRoutes } from './ui_api.js';

export function registerAPIRoutes(app) {
  registerSessionRoutes(app);
  registerMessagingRoutes(app);
  registerContactRoutes(app);
  registerSystemRoutes(app);
  registerUiApiRoutes(app);
}
