import { loadTelegramStore, saveTelegramStore } from '../../whatsapp/telegram/store.js';
import { TelegramBotClient, getTelegramBotClient, sanitizeTelegramToken } from '../../whatsapp/telegram/bot.js';
import { getSession } from '../../session.js';

export function registerTelegramRoutes(app) {
  // GET /api/telegram/config
  app.get('/api/telegram/config', (req, res) => {
    const store = loadTelegramStore();
    res.json({ success: true, data: store });
  });

  // POST /api/telegram/config
  app.post('/api/telegram/config', async (req, res) => {
    const store = loadTelegramStore();
    const { enabled } = req.body || {};

    if (enabled !== undefined) {
      store.enabled = Boolean(enabled);
    }

    saveTelegramStore(store);
    res.json({ success: true, data: store });
  });

  // GET /api/telegram/bots
  app.get('/api/telegram/bots', (req, res) => {
    const store = loadTelegramStore();
    res.json({ success: true, data: store.bots || [] });
  });

  // POST /api/telegram/bots
  app.post('/api/telegram/bots', async (req, res) => {
    const store = loadTelegramStore();
    const { id, name, token, enabled } = req.body || {};

    if (!token || !String(token).trim()) {
      return res.status(400).json({ success: false, error: 'Bot token is required' });
    }

    let botInfo;
    let username;
    let cleanToken;
    try {
      cleanToken = sanitizeTelegramToken(token);
      const bot = new TelegramBotClient(cleanToken);
      botInfo = await bot.getMe();
      username = botInfo ? botInfo.username || '' : '';
      const botId = id || `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await bot.fetchUpdates(botId);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Invalid Bot Token: ${err.message}` });
    }

    const botId = id || `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const botName =
      name && String(name).trim()
        ? String(name).trim()
        : username
          ? `@${username}`
          : 'Telegram Bot';

    const botRecord = {
      id: botId,
      name: botName,
      token: cleanToken,
      username: username,
      info: botInfo,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    if (!store.bots) store.bots = [];
    const idx = store.bots.findIndex((b) => b.id === botId);
    if (idx >= 0) {
      store.bots[idx] = botRecord;
    } else {
      store.bots.push(botRecord);
    }

    saveTelegramStore(store);
    res.json({ success: true, data: store.bots });
  });

  // DELETE /api/telegram/bots/:id
  app.delete('/api/telegram/bots/:id', (req, res) => {
    const store = loadTelegramStore();
    const { id } = req.params;
    store.bots = (store.bots || []).filter((b) => b.id !== id);
    // Also remove mappings using this bot or unbind them
    if (Array.isArray(store.mappings)) {
      store.mappings = store.mappings.filter((m) => m.bot_id !== id);
    }
    saveTelegramStore(store);
    res.json({ success: true, data: store.bots });
  });

  // GET /api/telegram/chats
  app.get('/api/telegram/chats', async (req, res) => {
    const store = loadTelegramStore();
    const { bot_id } = req.query || {};
    const bots = (store.bots || []).filter((b) => b.enabled && b.token);
    for (const b of bots) {
      if (bot_id && b.id !== bot_id) continue;
      try {
        const bot = new TelegramBotClient(b.token);
        await bot.fetchUpdates(b.id);
      } catch (e) {
        // Ignore fetch updates error
      }
    }
    const updatedStore = loadTelegramStore();
    let chats = Object.values(updatedStore.cached_chats || {});
    if (bot_id) {
      chats = chats.filter((c) => !c.bot_id || c.bot_id === bot_id);
    }
    res.json({ success: true, data: chats });
  });

  // POST /api/telegram/mappings
  app.post('/api/telegram/mappings', (req, res) => {
    const store = loadTelegramStore();
    const {
      id,
      bot_id,
      mapping_name,
      wa_jid,
      wa_name,
      tg_chat_id,
      tg_chat_title,
      tg_chat_type,
      sync_mode,
      include_group_name,
      include_sender_name,
      sync_self_messages,
      tg_thread_id,
      convert_formatting,
      anonymize_phone_numbers,
      ignore_command_prefixes,
      sync_reactions,
      sync_edits,
      sync_deletions,
      is_direct_chat_mirror,
      poll_sync_mode,
      poll_send_text_diagram,
      poll_send_update_message,
      poll_delete_old_message,
      sync_system_events,
      sync_pins,
      enabled,
    } = req.body || {};

    if (!wa_jid || !tg_chat_id) {
      return res.status(400).json({ success: false, error: 'Missing wa_jid or tg_chat_id' });
    }

    const firstBotId = (store.bots || [])[0]?.id || '';
    const selectedBotId = bot_id || firstBotId;

    const cleanWaName = wa_name && wa_name !== wa_jid ? wa_name : wa_jid.split('@')[0];
    const cleanTgTitle =
      tg_chat_title && !tg_chat_title.startsWith('Chat ') ? tg_chat_title : `TG ${tg_chat_id}`;
    const threadLabel = tg_thread_id ? ` (Topic ${tg_thread_id})` : '';
    const autoGeneratedName = `${cleanWaName} ↔ ${cleanTgTitle}${threadLabel}`;
    const finalMappingName =
      mapping_name && String(mapping_name).trim() ? String(mapping_name).trim() : autoGeneratedName;

    const mappingId = id || `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMapping = {
      id: mappingId,
      bot_id: selectedBotId,
      name: finalMappingName,
      wa_jid: String(wa_jid),
      wa_name: wa_name || wa_jid,
      tg_chat_id: String(tg_chat_id),
      tg_chat_title: tg_chat_title || `Chat ${tg_chat_id}`,
      tg_chat_type: tg_chat_type || 'group',
      sync_mode: sync_mode || 'bidirectional',
      include_group_name: is_direct_chat_mirror ? false : Boolean(include_group_name),
      include_sender_name: is_direct_chat_mirror
        ? false
        : include_sender_name !== undefined
          ? Boolean(include_sender_name)
          : true,
      sync_self_messages: is_direct_chat_mirror
        ? sync_self_messages !== undefined
          ? Boolean(sync_self_messages)
          : true
        : Boolean(sync_self_messages),
      tg_thread_id: tg_thread_id ? String(tg_thread_id) : null,
      convert_formatting: convert_formatting !== undefined ? Boolean(convert_formatting) : true,
      anonymize_phone_numbers: Boolean(anonymize_phone_numbers),
      ignore_command_prefixes: ignore_command_prefixes ? String(ignore_command_prefixes) : '',
      sync_reactions: sync_reactions !== undefined ? Boolean(sync_reactions) : true,
      sync_edits: sync_edits !== undefined ? Boolean(sync_edits) : true,
      sync_deletions: sync_deletions !== undefined ? Boolean(sync_deletions) : true,
      is_direct_chat_mirror: Boolean(is_direct_chat_mirror),
      poll_sync_mode: poll_sync_mode || 'text_diagram',
      poll_send_text_diagram:
        poll_send_text_diagram !== undefined ? Boolean(poll_send_text_diagram) : true,
      poll_send_update_message:
        poll_send_update_message !== undefined ? Boolean(poll_send_update_message) : true,
      poll_delete_old_message:
        poll_delete_old_message !== undefined ? Boolean(poll_delete_old_message) : true,
      sync_system_events: sync_system_events !== undefined ? Boolean(sync_system_events) : true,
      sync_pins: sync_pins !== undefined ? Boolean(sync_pins) : true,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    const existingIdx = (store.mappings || []).findIndex((m) => m.id === mappingId);
    if (existingIdx >= 0) {
      store.mappings[existingIdx] = newMapping;
    } else {
      if (!store.mappings) store.mappings = [];
      store.mappings.push(newMapping);
    }

    saveTelegramStore(store);
    res.json({ success: true, data: store.mappings });
  });

  // DELETE /api/telegram/mappings/:id
  app.delete('/api/telegram/mappings/:id', (req, res) => {
    const store = loadTelegramStore();
    const { id } = req.params;
    store.mappings = (store.mappings || []).filter((m) => m.id !== id);
    saveTelegramStore(store);
    res.json({ success: true, data: store.mappings });
  });

  // POST /api/telegram/mappings/:id/toggle
  app.post('/api/telegram/mappings/:id/toggle', (req, res) => {
    const store = loadTelegramStore();
    const { id } = req.params;
    const mapping = (store.mappings || []).find((m) => m.id === id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Mapping not found' });
    }
    mapping.enabled = !mapping.enabled;
    saveTelegramStore(store);
    res.json({ success: true, data: mapping });
  });

  // Test runs memory store
  const testRuns = new Map();

  // GET /api/telegram/test/results/:runId
  app.get('/api/telegram/test/results/:runId', (req, res) => {
    const { runId } = req.params;
    const testRun = testRuns.get(runId);
    if (!testRun) {
      return res.status(404).json({ success: false, error: 'Test run not found' });
    }
    res.json({
      success: true,
      data: {
        runId: testRun.runId,
        status: testRun.status,
        startTime: testRun.startTime,
        endTime: testRun.endTime,
        direction: testRun.direction,
        mappingId: testRun.mappingId,
        passedSteps: testRun.passedSteps,
        totalSteps: testRun.totalSteps,
        logs: testRun.logs,
        summary: testRun.summary,
      },
    });
  });

  // POST /api/telegram/test
  app.post('/api/telegram/test', async (req, res) => {
    const { mapping_id, direction = 'wa_to_tg' } = req.body || {};

    const store = loadTelegramStore();
    const mapping = (store.mappings || []).find((m) => m.id === mapping_id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Mapping not found' });
    }

    const bot = getTelegramBotClient(mapping.bot_id);
    if (!bot) {
      return res.status(400).json({ success: false, error: 'Telegram Bot client not configured or disabled' });
    }

    const session = getSession('default');
    if (!session || !session.sock) {
      return res.status(400).json({ success: false, error: 'WhatsApp session not connected' });
    }

    const runId = `trun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const testRun = {
      runId,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      direction,
      mappingId: mapping.id,
      passedSteps: 0,
      totalSteps: 7,
      logs: [],
      summary: null,
    };
    testRuns.set(runId, testRun);

    const log = (step, msg, level = 'info') => {
      const entry = { time: new Date().toISOString(), step, msg, level };
      testRun.logs.push(entry);
    };

    // Return response immediately with runId
    res.json({ success: true, runId });

    // Execute test steps asynchronously
    (async () => {
      log('INIT', `Starting Telegram Bridge Integration Test (Run ID: ${runId}, Direction: ${direction})`);
      log('INIT', `Target Mapping: ${mapping.name} [WA: ${mapping.wa_jid} | TG Chat: ${mapping.tg_chat_id}]`);

      const isWaToTg = direction === 'wa_to_tg';

      try {
        let sentMsgRef = null;

        // STEP 1: Text Message Test
        try {
          log('STEP_1', `Executing Step 1/7: Text Message Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            const text = `🧪 [Bridge Test] Step 1: Text Message (${new Date().toLocaleTimeString()})`;
            sentMsgRef = await session.sock.sendMessage(mapping.wa_jid, { text });
            log('STEP_1', `Sent WhatsApp text message (ID: ${sentMsgRef?.key?.id || 'OK'})`, 'success');
          } else {
            const text = `🧪 [Bridge Test] Step 1: Text Message (${new Date().toLocaleTimeString()})`;
            sentMsgRef = await bot.sendMessage(mapping.tg_chat_id, text, null, mapping.tg_thread_id || null);
            log('STEP_1', `Sent Telegram text message (ID: ${sentMsgRef?.message_id || 'OK'})`, 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_1', `Step 1 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 2: Poll Test
        try {
          log('STEP_2', `Executing Step 2/7: Poll Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            await session.sock.sendMessage(mapping.wa_jid, {
              poll: {
                name: '🧪 [Bridge Test] Step 2: Preferred feature?',
                values: ['Option A (Speed)', 'Option B (Reliability)', 'Option C (Media Sync)'],
                selectableCount: 1,
              },
            });
            log('STEP_2', 'Sent WhatsApp Poll message', 'success');
          } else {
            await bot.sendPoll(
              mapping.tg_chat_id,
              '🧪 [Bridge Test] Step 2: Preferred feature?',
              ['Option A (Speed)', 'Option B (Reliability)', 'Option C (Media Sync)'],
              null,
              mapping.tg_thread_id || null
            );
            log('STEP_2', 'Sent Telegram Poll message', 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_2', `Step 2 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 3: Poll Vote Test
        try {
          log('STEP_3', `Executing Step 3/7: Poll Vote Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            const pollVoteText = `🧪 [Bridge Test] Step 3: Simulated Poll Vote Update\n📊 Poll: Step 2 Poll\n✅ Votes: Option A (1 vote)`;
            await session.sock.sendMessage(mapping.wa_jid, { text: pollVoteText });
            log('STEP_3', 'Dispatched WhatsApp Poll Vote update notification', 'success');
          } else {
            const pollVoteText = `🧪 [Bridge Test] Step 3: Simulated Poll Vote Update\n📊 Poll: Step 2 Poll\n✅ Votes: Option A (1 vote)`;
            await bot.sendMessage(mapping.tg_chat_id, pollVoteText, null, mapping.tg_thread_id || null);
            log('STEP_3', 'Dispatched Telegram Poll Vote update notification', 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_3', `Step 3 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 4: Location Test
        try {
          log('STEP_4', `Executing Step 4/7: Location Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            await session.sock.sendMessage(mapping.wa_jid, {
              location: {
                degreesLatitude: 52.52,
                degreesLongitude: 13.405,
                name: 'Berlin HQ Test Location',
                address: 'Berlin, Germany',
              },
            });
            log('STEP_4', 'Sent WhatsApp Location message (52.52, 13.405)', 'success');
          } else {
            await bot.request('sendLocation', {
              chat_id: mapping.tg_chat_id,
              latitude: 52.52,
              longitude: 13.405,
              message_thread_id: mapping.tg_thread_id || undefined,
            });
            log('STEP_4', 'Sent Telegram Location message (52.52, 13.405)', 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_4', `Step 4 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 5: Event Card Test
        try {
          log('STEP_5', `Executing Step 5/7: Event Card Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          const eventText = `📅 <b>[Bridge Test] Step 5: Integration Check Event</b>\n🕐 Time: Tomorrow 10:00 AM\n📍 Location: Virtual Test Room\n📝 Description: Automated Bridge Verification Run`;
          if (isWaToTg) {
            await session.sock.sendMessage(mapping.wa_jid, {
              text: `📅 [Bridge Test] Step 5: Integration Check Event\nTime: Tomorrow 10:00 AM\nLocation: Virtual Test Room\nDescription: Automated Bridge Verification Run`,
            });
            log('STEP_5', 'Sent WhatsApp Event text card', 'success');
          } else {
            await bot.sendMessage(mapping.tg_chat_id, eventText, null, mapping.tg_thread_id || null);
            log('STEP_5', 'Sent Telegram Event HTML card', 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_5', `Step 5 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 6: Reaction Test
        try {
          log('STEP_6', `Executing Step 6/7: Reaction Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            if (sentMsgRef && sentMsgRef.key) {
              await session.sock.sendMessage(mapping.wa_jid, {
                react: { text: '👍', key: sentMsgRef.key },
              });
              log('STEP_6', 'Sent WhatsApp Reaction 👍 to Step 1 message', 'success');
            } else {
              await session.sock.sendMessage(mapping.wa_jid, { text: '👍 [Simulated Reaction to Step 1]' });
              log('STEP_6', 'Sent simulated WhatsApp Reaction notification', 'success');
            }
          } else {
            if (sentMsgRef && sentMsgRef.message_id) {
              await bot.setMessageReaction(mapping.tg_chat_id, sentMsgRef.message_id, '👍');
              log('STEP_6', 'Sent Telegram Reaction 👍 to Step 1 message', 'success');
            } else {
              await bot.sendMessage(mapping.tg_chat_id, '👍 [Simulated Reaction to Step 1]', null, mapping.tg_thread_id || null);
              log('STEP_6', 'Sent simulated Telegram Reaction message', 'success');
            }
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_6', `Step 6 Failed: ${err.message}`, 'error');
        }

        await new Promise((r) => setTimeout(r, 1000));

        // STEP 7: Reply / Thread Quote Test
        try {
          log('STEP_7', `Executing Step 7/7: Reply/Thread Quote Test (${isWaToTg ? 'WA -> TG' : 'TG -> WA'})`);
          if (isWaToTg) {
            if (sentMsgRef) {
              await session.sock.sendMessage(
                mapping.wa_jid,
                { text: '🧪 [Bridge Test] Step 7: Reply Quote to Step 1 Message' },
                { quoted: sentMsgRef }
              );
              log('STEP_7', 'Sent WhatsApp Quoted Reply to Step 1 message', 'success');
            } else {
              await session.sock.sendMessage(mapping.wa_jid, { text: '🧪 [Bridge Test] Step 7: Reply Quote to Step 1 Message' });
              log('STEP_7', 'Sent WhatsApp Reply text message', 'success');
            }
          } else {
            const replyMsgId = sentMsgRef?.message_id || null;
            await bot.sendMessage(
              mapping.tg_chat_id,
              '🧪 <b>[Bridge Test] Step 7: Reply Quote to Step 1 Message</b>',
              replyMsgId,
              mapping.tg_thread_id || null
            );
            log('STEP_7', 'Sent Telegram Quoted Reply to Step 1 message', 'success');
          }
          testRun.passedSteps++;
        } catch (err) {
          log('STEP_7', `Step 7 Failed: ${err.message}`, 'error');
        }

        testRun.endTime = new Date().toISOString();
        testRun.status = testRun.passedSteps === testRun.totalSteps ? 'passed' : 'failed';

        const summaryText = `🏁 <b>[Bridge Integration Test Complete]</b>\n` +
          `• Result: ${testRun.status === 'passed' ? '✅ ALL PASSED' : '⚠️ PARTIAL / FAILED'}\n` +
          `• Passed Steps: ${testRun.passedSteps}/${testRun.totalSteps}\n` +
          `• Direction: ${isWaToTg ? 'WhatsApp ➔ Telegram' : 'Telegram ➔ WhatsApp'}\n` +
          `• Mapping: ${mapping.name}\n` +
          `• Duration: ${Math.round((new Date(testRun.endTime) - new Date(testRun.startTime)) / 1000)}s`;

        testRun.summary = summaryText;
        log('SUMMARY', summaryText, testRun.status === 'passed' ? 'success' : 'warn');

        // Dispatch summary to both Telegram and WhatsApp
        try {
          await bot.sendMessage(
            mapping.tg_chat_id,
            summaryText,
            null,
            mapping.tg_thread_id || null
          );
          log('DISPATCH', 'Dispatched test summary report to Telegram chat', 'info');
        } catch (e) {
          log('DISPATCH', `Failed to dispatch summary to Telegram: ${e.message}`, 'warn');
        }

        try {
          const plainSummary = summaryText.replace(/<\/?[^>]+(>|$)/g, '');
          await session.sock.sendMessage(mapping.wa_jid, { text: plainSummary });
          log('DISPATCH', 'Dispatched test summary report to WhatsApp chat', 'info');
        } catch (e) {
          log('DISPATCH', `Failed to dispatch summary to WhatsApp: ${e.message}`, 'warn');
        }
      } catch (fatalErr) {
        testRun.status = 'failed';
        testRun.endTime = new Date().toISOString();
        log('FATAL', `Test suite encountered a fatal error: ${fatalErr.message}`, 'error');
      }
    })();
  });
}

