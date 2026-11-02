import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerMcpRoutes } from '../src/routes/api/mcp.js';

test('MCP SSE and messages route registration & body handling', async () => {
  const app = express();
  app.use(express.json());
  registerMcpRoutes(app);

  const routes = app.router?.stack || app._router?.stack || [];
  const registeredPaths = routes
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  assert.ok(
    registeredPaths.some((r) => r.path === '/mcp' && r.methods.includes('get')),
    'GET /mcp should be registered'
  );
  assert.ok(
    registeredPaths.some((r) => r.path === '/mcp/messages' && r.methods.includes('post')),
    'POST /mcp/messages should be registered'
  );
});
