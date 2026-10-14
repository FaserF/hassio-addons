import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../logger.js';
import { getSession } from '../../session.js';
import { getJid } from '../../utils/jid.js';
import { ensureConnected } from './helpers.js';
import { trackSent } from '../../whatsapp/actions.js';
import { API_TOKEN } from '../../config.js';

function checkMcpAuth(req) {
  const token = req.header('X-Auth-Token') || req.query?.token;
  if (!API_TOKEN) return true;
  return token === API_TOKEN;
}

export function registerMcpRoutes(app) {
  let sseTransport = null;

  const server = new Server(
    {
      name: 'whatsapp-addon-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'whatsapp_send_message',
          description: 'Send a WhatsApp text message to a user or group.',
          inputSchema: {
            type: 'object',
            properties: {
              number: {
                type: 'string',
                description: 'Phone number with country code (e.g. 491701234567) or JID/group ID.',
              },
              message: {
                type: 'string',
                description: 'The text message to send.',
              },
            },
            required: ['number', 'message'],
          },
        },
        {
          name: 'whatsapp_send_image',
          description: 'Send an image from an HTTP/HTTPS URL or local path to a WhatsApp recipient.',
          inputSchema: {
            type: 'object',
            properties: {
              number: {
                type: 'string',
                description: 'Phone number or JID/group ID.',
              },
              url: {
                type: 'string',
                description: 'URL or local file path to the image.',
              },
              caption: {
                type: 'string',
                description: 'Optional image caption.',
              },
            },
            required: ['number', 'url'],
          },
        },
        {
          name: 'whatsapp_list_chats',
          description: 'List active chats and conversations.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of chats to return (default 50).',
              },
            },
          },
        },
        {
          name: 'whatsapp_list_groups',
          description: 'List participating WhatsApp groups with subjects and participant counts.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'whatsapp_list_contacts',
          description: 'List cached WhatsApp contacts and verified names.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const session = getSession('default');

    if (!session) {
      return {
        content: [{ type: 'text', text: 'Error: No active WhatsApp session found.' }],
        isError: true,
      };
    }

    const connected = await ensureConnected(session, 4000);
    if (!connected) {
      return {
        content: [{ type: 'text', text: 'Error: WhatsApp is not connected. Check pairing status in Web UI.' }],
        isError: true,
      };
    }

    try {
      if (name === 'whatsapp_send_message') {
        const { number, message } = args;
        const jid = getJid(number);
        const sent = await session.sock.sendMessage(jid, { text: message });
        trackSent(session, number, message);
        return {
          content: [
            {
              type: 'text',
              text: `Message sent successfully. ID: ${sent?.key?.id || 'unknown'}`,
            },
          ],
        };
      }

      if (name === 'whatsapp_send_image') {
        const { number, url, caption } = args;
        const jid = getJid(number);
        const sent = await session.sock.sendMessage(jid, {
          image: { url },
          caption: caption || '',
        });
        trackSent(session, number, `[Image] ${caption || ''}`);
        return {
          content: [
            {
              type: 'text',
              text: `Image sent successfully. ID: ${sent?.key?.id || 'unknown'}`,
            },
          ],
        };
      }

      if (name === 'whatsapp_list_chats') {
        const chatJids = new Set(session.chatCache?.keys() || []);
        if (session.messageStore) {
          for (const msg of session.messageStore.values()) {
            if (msg?.key?.remoteJid) chatJids.add(msg.key.remoteJid);
          }
        }
        if (session.groupCache) {
          for (const gId of session.groupCache.keys()) chatJids.add(gId);
        }
        chatJids.delete('status@broadcast');
        const limit = args?.limit || 50;
        const chats = Array.from(chatJids).slice(0, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify(chats, null, 2) }],
        };
      }

      if (name === 'whatsapp_list_groups') {
        const groups = await session.sock.groupFetchAllParticipating();
        const result = Object.values(groups).map((g) => ({
          id: g.id,
          subject: g.subject,
          participantsCount: g.participants?.length || 0,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      if (name === 'whatsapp_list_contacts') {
        const contacts = Array.from(session.contactCache?.values() || []).map((c) => ({
          id: c.id,
          name: c.name || c.notify || c.id.split('@')[0],
          notify: c.notify,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(contacts.slice(0, 100), null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (err) {
      logger.error({ error: err.message, tool: name }, '[MCP] Tool execution failed');
      return {
        content: [{ type: 'text', text: `Tool error: ${err.message}` }],
        isError: true,
      };
    }
  });

  // SSE Transport endpoint
  app.get('/mcp', async (req, res) => {
    if (!checkMcpAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or missing X-Auth-Token' });
    }

    try {
      sseTransport = new SSEServerTransport('/mcp/messages', res);
      await server.connect(sseTransport);
      logger.info('[MCP] Client connected via SSE transport');

      req.on('close', () => {
        logger.info('[MCP] Client SSE connection closed');
      });
    } catch (err) {
      logger.error({ error: err.message }, '[MCP] Failed to establish SSE transport');
      if (!res.headersSent) res.status(500).send('MCP SSE init error');
    }
  });

  // SSE Message Ingestion
  app.post('/mcp/messages', async (req, res) => {
    if (!checkMcpAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or missing X-Auth-Token' });
    }

    if (!sseTransport) {
      return res.status(400).json({ error: 'No active MCP SSE transport session' });
    }

    try {
      await sseTransport.handlePostMessage(req, res);
    } catch (err) {
      logger.error({ error: err.message }, '[MCP] Failed to handle client post message');
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  logger.info('🔌 MCP Server routes registered at /mcp and /mcp/messages');
}
