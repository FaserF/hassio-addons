import { loadTelegramStore, saveTelegramStore, updateCachedChat } from '../store.js';
import { getTelegramBotClient } from '../bot.js';
import { recordMessageMap, resolveWaMsgFromTg } from '../message_map.js';
import { telegramToWaFormatting, splitMessageText, WHATSAPP_MAX_TEXT_LENGTH } from '../format.js';
import { formatHeader } from '../headers.js';
import { getSession, sessions } from '../../../session.js';
import { logger } from '../../../logger.js';
import { t } from '../../../locales/loader.js';
import { ignoreWaEditEchoes, ignoreTgEditEchoes } from '../outbound/mutations.js';
import { getGroupModerationConfig } from '../../moderation/store.js';
import {
  trackPinnedMessage,
  untrackPinnedMessage,
  getTrackedPinnedMessages,
} from '../../moderation/commands/admin/content.js';
import { translateTextGatewayWithReason } from '../../../utils/gatewayTranslator.js';

const lastUpdateIds = new Map();
const recentPinnedFallbacks = new Map();
let isProcessingTelegramUpdates = false;

export async function processTelegramUpdates() {
  if (isProcessingTelegramUpdates) return;
  isProcessingTelegramUpdates = true;
  try {
    const store = loadTelegramStore();
    if (!store.enabled) return;

    const bots = (store.bots || []).filter((b) => b.enabled && b.token);
    if (bots.length === 0) return;

    for (const botConfig of bots) {
      const bot = getTelegramBotClient(botConfig.id);
      if (!bot) continue;

      let lastUpdateId = lastUpdateIds.get(botConfig.id) || 0;

      try {
        const updates = await bot.request('getUpdates', {
          offset: lastUpdateId + 1,
          limit: 50,
          timeout: 0,
          allowed_updates: [
            'message',
            'edited_message',
            'channel_post',
            'edited_channel_post',
            'message_reaction',
            'message_reaction_count',
            'poll',
            'poll_answer',
          ],
        });

        if (!Array.isArray(updates) || updates.length === 0) continue;

        for (const update of updates) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          lastUpdateIds.set(botConfig.id, lastUpdateId);

          // Handle Telegram Poll Answers (when a user votes or changes vote in a poll)
          if (update.poll_answer) {
            const pa = update.poll_answer;
            const pollId = String(pa.poll_id);
            const voterName = pa.user
              ? `${pa.user.first_name || ''} ${pa.user.last_name || ''}`.trim() ||
                pa.user.username ||
                'Telegram User'
              : 'Telegram User';
            const selectedOptionIds = pa.option_ids || [];

            // Find stored poll details if cached
            const cachedPoll = store.cached_polls?.[pollId];
            const pollQuestion = cachedPoll?.question || 'Poll';
            const pollOptions = cachedPoll?.options || [];
            const selectedText = selectedOptionIds
              .map((idx) => pollOptions[idx] || `Option ${idx + 1}`)
              .join(', ');

            // Cache last vote info for consolidated update with update.poll
            if (!store.cached_polls) store.cached_polls = {};
            if (!store.cached_polls[pollId]) store.cached_polls[pollId] = {};
            store.cached_polls[pollId].last_vote_info = {
              voterName,
              selectedText,
              selectedOptionIds,
              timestamp: Date.now(),
            };
            saveTelegramStore(store);

            const tgChatId = String(pa.voter_chat?.id || cachedPoll?.chat_id || '');
            const mappings = (store.mappings || []).filter(
              (m) =>
                m.enabled &&
                (!tgChatId || String(m.tg_chat_id) === tgChatId) &&
                (!m.bot_id || m.bot_id === botConfig.id) &&
                (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
            );

            // For mappings not in native_sync (or where update.poll might not trigger), dispatch voteText
            for (const mapping of mappings) {
              const pollMode = mapping.poll_sync_mode || 'native_sync';
              if (pollMode === 'once_no_update') continue;
              // If in native_sync, update.poll will deliver the consolidated vote + leader message in one single message
              if (pollMode === 'native_sync') continue;
              if (mapping.poll_send_update_message === false) continue;

              const voteText =
                selectedOptionIds.length > 0
                  ? `📊 [Poll Vote Update: ${pollQuestion}]\n👤 Voter: ${voterName}\n🗳️ Vote: ${selectedText}`
                  : `📊 [Poll Vote Update: ${pollQuestion}]\n👤 Voter: ${voterName}\n🗳️ Vote: Retracted (No options selected)`;

              let session = getSession('default');
              if (!session || !session.sock || !session.isConnected) {
                for (const s of sessions.values()) {
                  if (s.sock && s.isConnected) {
                    session = s;
                    break;
                  }
                }
              }
              if (session && session.sock && session.isConnected) {
                try {
                  // Delete previous poll vote update message if stored to avoid chat cluttering
                  const oldWaVoteMsgKey = cachedPoll?.last_wa_vote_msg_key;
                  if (oldWaVoteMsgKey && mapping.poll_delete_old_update !== false) {
                    try {
                      await session.sock.sendMessage(mapping.wa_jid, { delete: oldWaVoteMsgKey });
                    } catch (_delErr) {}
                  }
                  const sentWaMsg = await session.sock.sendMessage(mapping.wa_jid, {
                    text: voteText,
                  });
                  if (sentWaMsg?.key && pollId) {
                    store.cached_polls[pollId].last_wa_vote_msg_key = sentWaMsg.key;
                    saveTelegramStore(store);
                  }
                } catch (e) {
                  logger.error(
                    { error: e.message },
                    '❌ Failed to sync Telegram poll vote to WhatsApp'
                  );
                }
              }
            }
            continue;
          }

          // Handle Telegram Callback Queries (Inline button clicks)
          if (update.callback_query) {
            const cq = update.callback_query;
            const cqId = cq.id;
            const data = cq.data || '';
            const user = cq.from;
            const voterName = user
              ? `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
                user.username ||
                'Telegram User'
              : 'Telegram User';
            const tgChatId = String(cq.message?.chat?.id || '');

            const bot = getTelegramBotClient(botConfig.id);
            if (bot) {
              await bot.answerCallbackQuery(cqId, '✅ Received', false).catch(() => null);
            }

            let buttonText = data;
            if (
              data.startsWith('btn:') ||
              data.startsWith('list:') ||
              data.startsWith('poll_vote:')
            ) {
              buttonText = data.split(':')[1] || data;
            }

            const responseText = `🔘 [Telegram Button Interaction]\n👤 User: ${voterName}\n🗳️ Selected: ${buttonText}`;

            const mappings = (store.mappings || []).filter(
              (m) =>
                m.enabled &&
                (!tgChatId || String(m.tg_chat_id) === tgChatId) &&
                (!m.bot_id || m.bot_id === botConfig.id) &&
                (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
            );

            for (const mapping of mappings) {
              let session = getSession('default');
              if (!session || !session.sock || !session.isConnected) {
                for (const s of sessions.values()) {
                  if (s.sock && s.isConnected) {
                    session = s;
                    break;
                  }
                }
              }
              if (session && session.sock && session.isConnected) {
                try {
                  await session.sock.sendMessage(mapping.wa_jid, { text: responseText });
                } catch (e) {
                  logger.debug(
                    { error: e.message },
                    'Failed to mirror Telegram callback query to WA'
                  );
                }
              }
            }
            continue;
          }

          // Handle Telegram Poll Updates (when poll options or total voters change)
          if (update.poll) {
            const p = update.poll;
            const pollId = String(p.id);
            if (!store.cached_polls) store.cached_polls = {};
            const previousPoll = store.cached_polls[pollId];
            const lastVote = previousPoll?.last_vote_info;
            store.cached_polls[pollId] = {
              id: pollId,
              question: p.question,
              options: (p.options || []).map((o) => o.text),
              total_voter_count: p.total_voter_count,
              is_closed: p.is_closed,
              chat_id: previousPoll?.chat_id || '',
              last_wa_vote_msg_key: previousPoll?.last_wa_vote_msg_key,
              last_vote_info: lastVote,
            };
            saveTelegramStore(store);

            // Build text diagram update and send to mapped WhatsApp chats
            const tgChatIdForPoll = String(previousPoll?.chat_id || '');
            const pollMappings = (store.mappings || []).filter(
              (m) =>
                m.enabled &&
                (!tgChatIdForPoll || String(m.tg_chat_id) === tgChatIdForPoll) &&
                (!m.bot_id || m.bot_id === botConfig.id) &&
                (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
            );

            for (const mapping of pollMappings) {
              const pollMode = mapping.poll_sync_mode || 'native_sync';
              if (pollMode === 'once_no_update' || pollMode === 'native_no_vote') continue;

              const totalVotes = p.total_voter_count || 0;
              if (pollMode === 'native_sync') {
                // Auto-vote mode: send ONE unified message with voter info and current leader standings
                if (totalVotes > 0) {
                  const sortedOpts = [...(p.options || [])].sort(
                    (a, b) => (b.voter_count || 0) - (a.voter_count || 0)
                  );
                  const winner = sortedOpts[0];
                  if (winner && winner.voter_count > 0) {
                    const isRecentVote = lastVote && Date.now() - lastVote.timestamp < 15000;
                    const winnerLine = `🏆 Leading Option: ${winner.text} (${winner.voter_count}/${totalVotes} votes)`;

                    let unifiedPollText;
                    if (isRecentVote) {
                      unifiedPollText = `📊 [Poll Vote Update: ${p.question}]\n👤 Voter: ${lastVote.voterName}\n🗳️ Vote: ${lastVote.selectedText}\n${winnerLine}`;
                    } else {
                      unifiedPollText = `🗳️ [Poll Leader / Auto-Vote: ${p.question}]\n${winnerLine}`;
                    }

                    let session = getSession('default');
                    if (!session || !session.sock || !session.isConnected) {
                      for (const s of sessions.values()) {
                        if (s.sock && s.isConnected) {
                          session = s;
                          break;
                        }
                      }
                    }
                    if (session && session.sock && session.isConnected) {
                      const oldWaVoteMsgKey = store.cached_polls?.[pollId]?.last_wa_vote_msg_key;
                      if (oldWaVoteMsgKey && mapping.poll_delete_old_update !== false) {
                        try {
                          await session.sock.sendMessage(mapping.wa_jid, {
                            delete: oldWaVoteMsgKey,
                          });
                        } catch (_delErr) {}
                      }
                      const sentWaMsg = await session.sock
                        .sendMessage(mapping.wa_jid, { text: unifiedPollText })
                        .catch(() => null);
                      if (sentWaMsg?.key && pollId) {
                        store.cached_polls[pollId].last_wa_vote_msg_key = sentWaMsg.key;
                        saveTelegramStore(store);
                      }
                    }
                  }
                }
                continue;
              }
              if (mapping.poll_send_update_message === false) continue;

              const optLines = (p.options || []).map((opt) => {
                const pct = totalVotes > 0 ? Math.round((opt.voter_count / totalVotes) * 100) : 0;
                const bar =
                  '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
                return `  ${opt.text}\n  ${bar} ${opt.voter_count} (${pct}%)`;
              });
              const closedLabel = p.is_closed ? ' ✅ Closed' : '';
              const updateText = `📊 [Poll Update${closedLabel}: ${p.question}]\n${optLines.join('\n')}\n👥 Total voters: ${totalVotes}`;

              let session = getSession('default');
              if (!session || !session.sock || !session.isConnected) {
                for (const s of sessions.values()) {
                  if (s.sock && s.isConnected) {
                    session = s;
                    break;
                  }
                }
              }
              if (session && session.sock && session.isConnected) {
                try {
                  await session.sock.sendMessage(mapping.wa_jid, { text: updateText });
                } catch (e) {
                  logger.error(
                    { error: e.message },
                    '❌ Failed to send Telegram poll update to WhatsApp'
                  );
                }
              }
            }
            continue;
          }

          // Handle Telegram Message Reactions (message_reaction updates)
          if (update.message_reaction) {
            const reactObj = update.message_reaction;
            const tgChatId = String(reactObj.chat.id);
            const tgMsgId = String(reactObj.message_id);
            const newReactions = reactObj.new_reaction || [];
            const latestEmoji =
              newReactions.length > 0 ? newReactions[newReactions.length - 1].emoji : '';

            const mappings = (store.mappings || []).filter(
              (m) =>
                m.enabled &&
                String(m.tg_chat_id) === tgChatId &&
                (!m.bot_id || m.bot_id === botConfig.id) &&
                (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
            );

            if (mappings.length > 0) {
              const mapped = resolveWaMsgFromTg(tgChatId, tgMsgId);
              if (mapped && mapped.waMsgId && mapped.waJid) {
                let session = getSession('default');
                if (!session || !session.sock || !session.isConnected) {
                  for (const s of sessions.values()) {
                    if (s.sock && s.isConnected) {
                      session = s;
                      break;
                    }
                  }
                }
                if (session && session.sock && session.isConnected) {
                  try {
                    const isFromMe = mapped.fromMe !== undefined ? mapped.fromMe : false;
                    const reactionKey = {
                      remoteJid: mapped.waJid,
                      id: mapped.waMsgId,
                      fromMe: isFromMe,
                    };
                    if (
                      !isFromMe &&
                      mapped.waJid.endsWith('@g.us') &&
                      mapped.senderJid &&
                      mapped.senderJid.includes('@')
                    ) {
                      reactionKey.participant = mapped.senderJid;
                    }
                    await session.sock.sendMessage(mapped.waJid, {
                      react: {
                        text: latestEmoji || '', // Empty string removes reaction in Baileys
                        key: reactionKey,
                      },
                    });
                  } catch (reactErr) {
                    logger.error(
                      { error: reactErr.message },
                      '❌ Failed to sync Telegram reaction to WhatsApp'
                    );
                  }
                }
              }
            }
            continue;
          }

          const isEdit = Boolean(update.edited_message || update.edited_channel_post);
          const msg =
            update.message ||
            update.channel_post ||
            update.edited_message ||
            update.edited_channel_post;
          if (!msg || !msg.chat) continue;

          if (isEdit && ignoreTgEditEchoes.has(String(msg.message_id))) {
            ignoreTgEditEchoes.delete(String(msg.message_id));
            logger.debug(
              { tgMsgId: msg.message_id },
              'Ignoring Telegram edit event echo from WhatsApp bridge'
            );
            continue;
          }

          updateCachedChat(msg.chat, botConfig.id);

          const tgChatId = String(msg.chat.id);
          const mappings = (store.mappings || []).filter(
            (m) =>
              m.enabled &&
              String(m.tg_chat_id) === tgChatId &&
              (!m.bot_id || m.bot_id === botConfig.id) &&
              (m.sync_mode === 'bidirectional' || m.sync_mode === 'inbound')
          );

          if (mappings.length === 0) continue;

          // Check offline catchup message age filter for Telegram inbound messages
          const catchupCfg = store.offline_catchup || { enabled: true, max_age_minutes: 2 };
          if (catchupCfg.enabled !== false && msg.date) {
            const msgTimeMs = Number(msg.date) * 1000;
            const maxAgeMs = Math.max(1, Number(catchupCfg.max_age_minutes || 2)) * 60 * 1000;
            const ageMs = Date.now() - msgTimeMs;
            if (ageMs > maxAgeMs) {
              logger.info(
                {
                  tgMsgId: msg.message_id,
                  ageSeconds: Math.round(ageMs / 1000),
                  maxAgeSeconds: Math.round(maxAgeMs / 1000),
                },
                '⏳ Skipping outdated offline Telegram message beyond catchup window'
              );
              continue;
            }
          }

          const senderName = msg.from
            ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() ||
              msg.from.username ||
              'Telegram User'
            : msg.chat.title || 'Telegram';
          let tgText = msg.text || msg.caption || '';
          let mediaPayload = null; // { url, type, mimetype }

          try {
            if (msg.sticker) {
              const emoji = msg.sticker.emoji ? ` ${msg.sticker.emoji}` : '';
              tgText = tgText || `[🎨 Sticker${emoji}]`;
              const fileId = msg.sticker.file_id;
              const fileUrl = await bot.getFileUrl(fileId);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: msg.sticker.is_animated || msg.sticker.is_video ? 'document' : 'sticker',
                  mimetype: msg.sticker.is_video ? 'video/webm' : 'image/webp',
                };
              }
            } else if (msg.animation) {
              tgText = tgText || '[🎞️ GIF]';
              const fileId = msg.animation.file_id;
              const fileUrl = await bot.getFileUrl(fileId);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: 'video',
                  mimetype: msg.animation.mime_type || 'video/mp4',
                };
              }
            } else if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
              tgText = tgText || '[📷 Photo]';
              const bestPhoto = msg.photo[msg.photo.length - 1];
              const fileUrl = await bot.getFileUrl(bestPhoto.file_id);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: 'image',
                  mimetype: 'image/jpeg',
                  mediaGroupId: msg.media_group_id || null,
                };
              }
            } else if (msg.video) {
              tgText = tgText || '[🎥 Video]';
              const fileUrl = await bot.getFileUrl(msg.video.file_id);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: 'video',
                  mimetype: msg.video.mime_type || 'video/mp4',
                  mediaGroupId: msg.media_group_id || null,
                };
              }
            } else if (msg.video_note) {
              tgText = tgText || '[📹 Video Note]';
              const fileUrl = await bot.getFileUrl(msg.video_note.file_id);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: 'video',
                  mimetype: 'video/mp4',
                  ptv: true,
                };
              }
            } else if (msg.voice) {
              tgText = tgText || '[🎤 Voice Note]';
              const fileUrl = await bot.getFileUrl(msg.voice.file_id);
              if (fileUrl) {
                let audioBuffer = null;
                try {
                  const res = await fetch(fileUrl);
                  if (res.ok) {
                    audioBuffer = Buffer.from(await res.arrayBuffer());
                  }
                } catch (_dlErr) {}
                mediaPayload = {
                  url: fileUrl,
                  buffer: audioBuffer,
                  type: 'audio',
                  mimetype: msg.voice.mime_type || 'audio/ogg; codecs=opus',
                  ptt: true,
                };
              }
            } else if (msg.audio) {
              tgText = tgText || '[🎵 Audio]';
              const fileUrl = await bot.getFileUrl(msg.audio.file_id);
              if (fileUrl) {
                let audioBuffer = null;
                try {
                  const res = await fetch(fileUrl);
                  if (res.ok) {
                    audioBuffer = Buffer.from(await res.arrayBuffer());
                  }
                } catch (_dlErr) {}
                mediaPayload = {
                  url: fileUrl,
                  buffer: audioBuffer,
                  type: 'audio',
                  mimetype: msg.audio.mime_type || 'audio/mp3',
                  ptt: false,
                };
              }
            } else if (msg.document) {
              tgText = tgText || `[📄 Document: ${msg.document.file_name || 'file'}]`;
              const fileUrl = await bot.getFileUrl(msg.document.file_id);
              if (fileUrl) {
                mediaPayload = {
                  url: fileUrl,
                  type: 'document',
                  mimetype: msg.document.mime_type || 'application/octet-stream',
                  fileName: msg.document.file_name,
                };
              }
            } else if (msg.contact) {
              const c = msg.contact;
              const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Contact';
              const phone = c.phone_number || '';
              const vcardStr = `BEGIN:VCARD\nVERSION:3.0\nN:${c.last_name || ''};${c.first_name || ''};;;\nFN:${fullName}\nTEL;type=CELL;type=VOICE;waid=${phone.replace(/\D/g, '')}:+${phone.replace(/\D/g, '')}\nEND:VCARD`;
              mediaPayload = {
                type: 'contact',
                displayName: fullName,
                vcard: vcardStr,
              };
              tgText = tgText || `👤 [Contact: ${fullName} (${phone})]`;
            } else if (msg.location) {
              const loc = msg.location;
              const isLive = Boolean(loc.live_period || msg.live_location);
              mediaPayload = {
                type: isLive ? 'live_location' : 'location',
                latitude: loc.latitude,
                longitude: loc.longitude,
              };
              tgText =
                tgText ||
                (isLive
                  ? `📍 [Live Location Share: ${loc.latitude}, ${loc.longitude}]`
                  : `📍 [Location Share: ${loc.latitude}, ${loc.longitude}]`);
            } else if (
              msg.new_chat_members &&
              Array.isArray(msg.new_chat_members) &&
              msg.new_chat_members.length > 0
            ) {
              const names = msg.new_chat_members
                .map(
                  (m) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username || 'User'
                )
                .join(', ');
              tgText = `👥 [System: ${names} joined the Telegram group]`;
            } else if (msg.left_chat_member) {
              const m = msg.left_chat_member;
              const name =
                `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.username || 'User';
              tgText = `👥 [System: ${name} left the Telegram group]`;
            } else if (msg.pinned_message) {
              const pinnedObj = msg.pinned_message;
              const pinnedSender = pinnedObj.from
                ? `${pinnedObj.from.first_name || ''} ${pinnedObj.from.last_name || ''}`.trim() ||
                  pinnedObj.from.username ||
                  'User'
                : 'User';
              const rawSnippet =
                pinnedObj.text ||
                pinnedObj.caption ||
                (pinnedObj.photo ? '[📷 Photo]' : '') ||
                (pinnedObj.video ? '[🎥 Video]' : '') ||
                (pinnedObj.document ? `[📄 ${pinnedObj.document.file_name || 'Document'}]` : '') ||
                'Message';
              const snippet =
                rawSnippet.length > 500 ? `${rawSnippet.slice(0, 500)}...` : rawSnippet;
              tgText = `📌 [Pinned Message by ${pinnedSender}]:\n\n${snippet}`;
            } else if (msg.poll) {
              const p = msg.poll;
              const pollOptions = (p.options || []).map((o) => o.text);
              const optStr =
                pollOptions.length > 0
                  ? `\nOptions:\n${pollOptions.map((o, i) => `  ${i + 1}️⃣ ${o}`).join('\n')}`
                  : '';
              tgText = `📊 [Poll: ${p.question || 'Untitled'}]${optStr}`;
              // Store native poll payload so per-mapping handler can create a native WA poll
              mediaPayload = {
                type: 'poll',
                question: p.question || 'Poll',
                options: pollOptions,
                allows_multiple_answers: Boolean(p.allows_multiple_answers),
                is_anonymous: Boolean(p.is_anonymous),
              };
              const pollId = String(p.id);
              if (!store.cached_polls) store.cached_polls = {};
              store.cached_polls[pollId] = {
                id: pollId,
                question: p.question,
                options: pollOptions,
                chat_id: tgChatId,
              };
              saveTelegramStore(store);
            }
          } catch (mediaErr) {
            logger.warn({ error: mediaErr.message }, '⚠️ Failed to fetch Telegram file URL');
          }

          if (!tgText && !mediaPayload) continue;

          const replyToTgId = msg.reply_to_message?.message_id;
          let quotedWaMsgId = null;
          let tgQuoteSnippet = '';
          if (replyToTgId) {
            const mapped = resolveWaMsgFromTg(tgChatId, replyToTgId);
            if (mapped) {
              quotedWaMsgId = mapped.waMsgId;
            } else if (msg.reply_to_message) {
              const qMsg = msg.reply_to_message;
              const qSender =
                qMsg.from?.first_name || qMsg.from?.username || qMsg.author_signature || 'User';
              const qMediaTag = qMsg.animation
                ? '🎥 [GIF/Video]'
                : qMsg.sticker
                  ? `🎨 [Sticker ${qMsg.sticker.emoji || ''}]`.trim()
                  : qMsg.photo
                    ? '📷 [Photo]'
                    : qMsg.video
                      ? '🎥 [Video]'
                      : qMsg.audio || qMsg.voice
                        ? '🎵 [Audio]'
                        : qMsg.document
                          ? `📄 [Document: ${qMsg.document.file_name || ''}]`.trim()
                          : '';
              const qText = qMsg.text || qMsg.caption || qMediaTag;
              const snippet = qText
                ? qText.length > 80
                  ? `${qText.substring(0, 80)}...`
                  : qText
                : '';
              if (snippet || qSender) {
                tgQuoteSnippet = `> [${qSender}]: ${snippet}\n`;
              }
            }
          }

          for (const mapping of mappings) {
            const isSystemMsg = Boolean(msg.new_chat_members || msg.left_chat_member);
            const isPinMsg = Boolean(msg.pinned_message);
            if (isSystemMsg && mapping.sync_system_events === false) continue;
            if (isPinMsg && mapping.sync_pins === false) continue;

            if (
              tgText &&
              (tgText.trim().startsWith('/unpin') || tgText.trim().startsWith('!unpin'))
            ) {
              if (mapping.sync_pins !== false) {
                const isUnpinAll =
                  tgText.trim().startsWith('/unpinall') || tgText.trim().startsWith('!unpinall');
                let session = getSession('default');
                if (!session || !session.sock || !session.isConnected) {
                  for (const s of sessions.values()) {
                    if (s.sock && s.isConnected) {
                      session = s;
                      break;
                    }
                  }
                }
                if (session && session.sock && session.isConnected) {
                  try {
                    const bot = getTelegramBotClient(botConfig.id);
                    if (isUnpinAll) {
                      if (bot) {
                        await bot
                          .request('unpinAllChatMessages', { chat_id: tgChatId })
                          .catch(() => null);
                      }
                      const tracked = getTrackedPinnedMessages(mapping.wa_jid);
                      for (const [msgId, item] of Object.entries(tracked)) {
                        try {
                          await session.sock.sendMessage(mapping.wa_jid, {
                            pin: {
                              remoteJid: mapping.wa_jid,
                              id: item.id || msgId,
                              fromMe: Boolean(item.fromMe),
                              ...(item.participant ? { participant: item.participant } : {}),
                            },
                            type: 2,
                            time: 0,
                          });
                        } catch (_uErr) {
                          try {
                            await session.sock.sendMessage(mapping.wa_jid, {
                              pin: {
                                key: {
                                  remoteJid: mapping.wa_jid,
                                  id: item.id || msgId,
                                  fromMe: Boolean(item.fromMe),
                                  ...(item.participant ? { participant: item.participant } : {}),
                                },
                                type: 2,
                                time: 0,
                              },
                            });
                          } catch (_uErr2) {}
                        }
                        untrackPinnedMessage(mapping.wa_jid, msgId);
                      }
                      logger.info(
                        { tgChatId, waJid: mapping.wa_jid },
                        '📌 Mirrored /unpinall from Telegram to WhatsApp'
                      );
                    } else {
                      const targetTgMsgId = msg.reply_to_message?.message_id;
                      let mappedWaMsg = targetTgMsgId
                        ? resolveWaMsgFromTg(tgChatId, String(targetTgMsgId))
                        : null;

                      if (!mappedWaMsg) {
                        const tracked = getTrackedPinnedMessages(mapping.wa_jid);
                        const keys = Object.keys(tracked);
                        if (keys.length > 0) {
                          const lastKey = keys[keys.length - 1];
                          const lastItem = tracked[lastKey];
                          mappedWaMsg = {
                            waMsgId: lastKey,
                            fromMe: Boolean(lastItem?.fromMe),
                            senderJid: lastItem?.participant,
                          };
                        }
                      }

                      if (mappedWaMsg && mappedWaMsg.waMsgId) {
                        const isFromMe =
                          mappedWaMsg.fromMe !== undefined ? mappedWaMsg.fromMe : false;
                        const unpinKey = {
                          remoteJid: mapping.wa_jid,
                          fromMe: isFromMe,
                          id: mappedWaMsg.waMsgId,
                        };
                        if (
                          !isFromMe &&
                          mappedWaMsg.senderJid &&
                          mappedWaMsg.senderJid.includes('@')
                        ) {
                          unpinKey.participant = mappedWaMsg.senderJid;
                        }

                        let unpinSent = false;
                        try {
                          await session.sock.sendMessage(mapping.wa_jid, {
                            pin: unpinKey,
                            type: 2,
                            time: 0,
                          });
                          unpinSent = true;
                        } catch (_e1) {
                          try {
                            await session.sock.sendMessage(mapping.wa_jid, {
                              pin: {
                                key: unpinKey,
                                type: 2,
                                time: 0,
                              },
                            });
                            unpinSent = true;
                          } catch (e2) {
                            logger.warn(
                              { error: e2.message, waMsgId: mappedWaMsg.waMsgId },
                              'Failed to unpin message in WhatsApp'
                            );
                          }
                        }

                        if (unpinSent) {
                          untrackPinnedMessage(mapping.wa_jid, mappedWaMsg.waMsgId);
                        }

                        if (bot && targetTgMsgId) {
                          await bot
                            .request('unpinChatMessage', {
                              chat_id: tgChatId,
                              message_id: targetTgMsgId,
                            })
                            .catch(() => null);
                        }
                        logger.info(
                          { tgChatId, waMsgId: mappedWaMsg.waMsgId },
                          '📌 Mirrored /unpin from Telegram to WhatsApp'
                        );
                      }
                    }
                  } catch (unpinErr) {
                    logger.warn(
                      { error: unpinErr.message },
                      'Failed to unpin message in WhatsApp from TG command'
                    );
                  }
                }
              }
              continue;
            }

            if (mapping.ignore_command_prefixes && tgText) {
              const cleanText = tgText.trim();
              const prefixes = String(mapping.ignore_command_prefixes)
                .split(/[,;\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              if (!prefixes.includes('/')) {
                prefixes.push('/');
              }
              if (prefixes.some((p) => cleanText.startsWith(p))) {
                continue;
              }
            }

            const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
            const isDirectMirror = Boolean(mapping.is_direct_chat_mirror);
            const rawHeader = isDirectMirror
              ? ''
              : formatHeader(
                  isGroupChat ? msg.chat.title : null,
                  senderName,
                  mapping.include_group_name,
                  isGroupChat ? mapping.include_sender_name : false
                );
            const cleanHeader = rawHeader.replace(/<\/?b>/g, '');
            const entities = msg.entities || msg.caption_entities || null;
            let formattedTgText =
              mapping.convert_formatting !== false
                ? telegramToWaFormatting(tgText, entities)
                : tgText;

            const groupModCfg = getGroupModerationConfig(mapping.wa_jid);
            const isTranslateActive =
              Boolean(mapping.translate_tg_to_wa) ||
              (groupModCfg?.translation?.enabled !== false &&
                (groupModCfg?.translation?.mode === 'auto' ||
                  groupModCfg?.translation?.mode === 'forwards'));

            if (isTranslateActive && tgText && tgText.trim() && !isSystemMsg && !isPinMsg) {
              try {
                const targetLang =
                  mapping.translate_tg_to_wa_lang ||
                  groupModCfg?.translation?.target_lang ||
                  groupModCfg?.language ||
                  'de';
                const provider = groupModCfg?.translation?.provider || 'auto';
                const transRes = await translateTextGatewayWithReason(
                  tgText,
                  targetLang,
                  provider,
                  groupModCfg
                );
                if (
                  transRes?.translation &&
                  transRes.translation.trim() &&
                  transRes.translation.trim().toLowerCase() !== tgText.trim().toLowerCase()
                ) {
                  const srcBadge =
                    transRes.sourceLang &&
                    transRes.sourceLang !== '?' &&
                    transRes.sourceLang !== 'auto'
                      ? `${transRes.sourceLang.toUpperCase()} → `
                      : '';
                  const provBadge = transRes.providerName
                    ? ` • ${transRes.providerName}`
                    : transRes.provider
                      ? ` • ${transRes.provider}`
                      : '';
                  const note = `🌐 _[${srcBadge}${targetLang.toUpperCase()}${provBadge}]_\n`;
                  formattedTgText = `${note}${transRes.translation}`;
                }
              } catch (transErr) {
                logger.debug({ err: transErr.message }, 'Failed to translate TG->WA message');
              }
            }

            const outboundWaText = `${cleanHeader}${tgQuoteSnippet}${formattedTgText}`;

            let session = getSession('default');
            if (!session || !session.sock || !session.isConnected) {
              for (const s of sessions.values()) {
                if (s.sock && s.isConnected) {
                  session = s;
                  break;
                }
              }
            }
            if (session && session.sock && session.isConnected) {
              try {
                if (isPinMsg) {
                  const pinnedTgMsg = msg.pinned_message;
                  const pinnedTgMsgId = pinnedTgMsg?.message_id;
                  let mappedWaMsg = pinnedTgMsgId
                    ? resolveWaMsgFromTg(tgChatId, String(pinnedTgMsgId))
                    : null;

                  // Fallback: If the Telegram message was not yet bridged to WhatsApp, bridge it now and pin it
                  const fallbackKey = `${tgChatId}:${pinnedTgMsgId}:${mapping.wa_jid}`;
                  const now = Date.now();
                  // Clean up expired cache entries older than 60s
                  for (const [k, ts] of recentPinnedFallbacks.entries()) {
                    if (now - ts > 60000) recentPinnedFallbacks.delete(k);
                  }

                  if (
                    !mappedWaMsg &&
                    pinnedTgMsg &&
                    pinnedTgMsgId &&
                    !recentPinnedFallbacks.has(fallbackKey)
                  ) {
                    recentPinnedFallbacks.set(fallbackKey, now);
                    try {
                      const fallbackSent = await session.sock.sendMessage(mapping.wa_jid, {
                        text: `${cleanHeader}${tgText}`,
                      });
                      if (fallbackSent?.key?.id) {
                        mappedWaMsg = {
                          waMsgId: fallbackSent.key.id,
                          fromMe: true,
                          senderJid: null,
                        };
                        recordMessageMap(
                          fallbackSent.key.id,
                          tgChatId,
                          pinnedTgMsgId,
                          mapping.wa_jid,
                          true,
                          senderName
                        );
                      }
                    } catch (bridgeErr) {
                      logger.debug(
                        { error: bridgeErr.message },
                        'Failed to send unmapped pinned TG message to WhatsApp'
                      );
                    }
                  }

                  if (mappedWaMsg && mappedWaMsg.waMsgId) {
                    const isFromMe = mappedWaMsg.fromMe !== undefined ? mappedWaMsg.fromMe : false;
                    const snippet = String(tgText || '').slice(0, 100);
                    const pinKey = {
                      remoteJid: mapping.wa_jid,
                      fromMe: isFromMe,
                      id: mappedWaMsg.waMsgId,
                    };
                    if (!isFromMe && mappedWaMsg.senderJid && mappedWaMsg.senderJid.includes('@')) {
                      pinKey.participant = mappedWaMsg.senderJid;
                    }
                    try {
                      await session.sock.sendMessage(mapping.wa_jid, {
                        pin: pinKey,
                        type: 1,
                        time: 604800,
                      });
                      trackPinnedMessage(
                        mapping.wa_jid,
                        mappedWaMsg.waMsgId,
                        pinKey.participant,
                        isFromMe,
                        snippet
                      );
                      logger.info(
                        { tgChatId, tgPinnedId: pinnedTgMsgId, waMsgId: mappedWaMsg.waMsgId },
                        '📌 Mirrored Telegram message pin natively to WhatsApp'
                      );
                    } catch (pinErr) {
                      try {
                        // Fallback: Baileys nested pin format
                        await session.sock.sendMessage(mapping.wa_jid, {
                          pin: {
                            key: {
                              remoteJid: mapping.wa_jid,
                              fromMe: isFromMe,
                              id: mappedWaMsg.waMsgId,
                              ...(pinKey.participant ? { participant: pinKey.participant } : {}),
                            },
                            type: 1,
                            time: 604800,
                          },
                        });
                        trackPinnedMessage(
                          mapping.wa_jid,
                          mappedWaMsg.waMsgId,
                          pinKey.participant,
                          isFromMe,
                          snippet
                        );
                        logger.info(
                          { tgChatId, tgPinnedId: pinnedTgMsgId, waMsgId: mappedWaMsg.waMsgId },
                          '📌 Mirrored Telegram message pin natively to WhatsApp (nested format)'
                        );
                      } catch (nestedErr) {
                        logger.warn(
                          {
                            error: pinErr.message,
                            nestedError: nestedErr.message,
                            groupId: mapping.wa_jid,
                          },
                          'Native WhatsApp pin failed (bot may lack admin rights)'
                        );
                      }
                    }
                  } else {
                    logger.warn(
                      { tgChatId, tgPinnedId: pinnedTgMsgId, waJid: mapping.wa_jid },
                      '📌 Cannot mirror TG pin to WA: message could not be resolved or bridged.'
                    );
                  }
                  // Always skip sending the raw notification text in WhatsApp
                  continue;
                }

                if (isEdit) {
                  let editSucceeded = false;
                  const mapped = resolveWaMsgFromTg(tgChatId, String(msg.message_id));
                  if (mapped && mapped.waMsgId && mapped.waJid) {
                    try {
                      ignoreWaEditEchoes.add(mapped.waMsgId);
                      const sentEditRes = await session.sock.sendMessage(mapping.wa_jid, {
                        text: outboundWaText,
                        edit: {
                          remoteJid: mapping.wa_jid,
                          fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                          id: mapped.waMsgId,
                        },
                      });
                      if (sentEditRes?.key?.id) {
                        ignoreWaEditEchoes.add(sentEditRes.key.id);
                      }
                      editSucceeded = true;
                      logger.info(
                        { tgChatId, tgMsgId: msg.message_id, waMsgId: mapped.waMsgId },
                        '✏️ Mirrored Telegram message edit natively to WhatsApp'
                      );
                    } catch (editErr) {
                      ignoreWaEditEchoes.delete(mapped.waMsgId);
                      logger.info(
                        { err: editErr?.message, waMsgId: mapped.waMsgId },
                        'Native WhatsApp edit failed (e.g. >15m old), falling back to contextual update message'
                      );
                    }
                  }

                  if (!editSucceeded) {
                    const lang = groupModCfg?.language || store.language || 'en';
                    const editIndicator = t(lang, 'bot_replies.edited_msg_indicator');
                    const editOldText = t(lang, 'bot_replies.edited_msg_old');
                    let fallbackWaText = `${cleanHeader}${editIndicator}\n${tgQuoteSnippet}${formattedTgText}`;
                    const sendOpts = { text: fallbackWaText };

                    if (mapped && mapped.waMsgId) {
                      sendOpts.quoted = {
                        key: {
                          remoteJid: mapping.wa_jid,
                          fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                          id: mapped.waMsgId,
                        },
                        message: { conversation: '...' },
                      };
                    } else {
                      fallbackWaText = `${cleanHeader}${editIndicator} ${editOldText}\n${tgQuoteSnippet}${formattedTgText}`;
                      sendOpts.text = fallbackWaText;
                    }

                    const sentMsg = await session.sock.sendMessage(mapping.wa_jid, sendOpts);
                    if (sentMsg?.key?.id) {
                      recordMessageMap(
                        sentMsg.key.id,
                        tgChatId,
                        msg.message_id,
                        mapping.wa_jid,
                        sentMsg.key.fromMe
                      );
                    }
                    logger.info(
                      { tgChatId, tgMsgId: msg.message_id, waMsgId: sentMsg?.key?.id },
                      '✏️ Sent contextual Telegram message edit fallback to WhatsApp'
                    );
                  }
                  continue;
                }

                const cleanCmd = tgText
                  .trim()
                  .toLowerCase()
                  .replace(/^[!/#]+/, '');
                if (
                  (cleanCmd === 'del' ||
                    cleanCmd === 'delete' ||
                    cleanCmd === 'revoke' ||
                    cleanCmd === 'rm' ||
                    cleanCmd === 'remove') &&
                  replyToTgId
                ) {
                  const mapped = resolveWaMsgFromTg(tgChatId, String(replyToTgId));
                  if (mapped && mapped.waMsgId) {
                    await session.sock.sendMessage(mapping.wa_jid, {
                      delete: {
                        remoteJid: mapping.wa_jid,
                        fromMe: mapped.fromMe !== undefined ? mapped.fromMe : true,
                        id: mapped.waMsgId,
                      },
                    });
                    // Clean up both the target message and the !del command message in Telegram
                    await bot.deleteMessage(tgChatId, replyToTgId).catch(() => null);
                    await bot.deleteMessage(tgChatId, msg.message_id).catch(() => null);
                    logger.info(
                      { tgChatId, tgMsgId: replyToTgId, waMsgId: mapped.waMsgId },
                      '🗑️ Mirrored Telegram delete command to WhatsApp and cleaned up Telegram messages'
                    );
                    continue;
                  }
                }

                if (cleanCmd === 'unpinall' || cleanCmd === 'unpin_all') {
                  const { syncWhatsAppUnpinAllToTelegram } =
                    await import('../outbound/mutations.js');
                  const { clearTrackedPinnedMessages } =
                    await import('../../moderation/commands/admin/content.js');
                  clearTrackedPinnedMessages(mapping.wa_jid);
                  await syncWhatsAppUnpinAllToTelegram(mapping.wa_jid);
                  await bot.deleteMessage(tgChatId, msg.message_id).catch(() => null);
                  logger.info(
                    { tgChatId, waJid: mapping.wa_jid },
                    '📌 Mirrored Telegram !unpinall command across Telegram and WhatsApp'
                  );
                  continue;
                }

                if ((cleanCmd === 'unpin' || cleanCmd === 'entpinnen') && replyToTgId) {
                  const mapped = resolveWaMsgFromTg(tgChatId, String(replyToTgId));
                  if (mapped && mapped.waMsgId) {
                    const isFromMe = mapped.fromMe !== undefined ? mapped.fromMe : false;
                    await session.sock
                      .sendMessage(mapping.wa_jid, {
                        pin: {
                          remoteJid: mapping.wa_jid,
                          id: mapped.waMsgId,
                          fromMe: isFromMe,
                          ...(mapped.senderJid && mapped.senderJid.includes('@')
                            ? { participant: mapped.senderJid }
                            : {}),
                        },
                        type: 2,
                        time: 0,
                      })
                      .catch(() => null);
                    await bot.unpinChatMessage(tgChatId, replyToTgId).catch(() => null);
                    await bot.deleteMessage(tgChatId, msg.message_id).catch(() => null);
                    logger.info(
                      { tgChatId, tgMsgId: replyToTgId, waMsgId: mapped.waMsgId },
                      '📌 Mirrored Telegram unpin command to WhatsApp'
                    );
                    continue;
                  }
                }

                const sendOptions = {};
                if (quotedWaMsgId) {
                  sendOptions.quoted = { key: { remoteJid: mapping.wa_jid, id: quotedWaMsgId } };
                }

                let waContent = { text: outboundWaText };
                if (mediaPayload) {
                  if (mediaPayload.type === 'location' || mediaPayload.type === 'liveLocation') {
                    waContent = {
                      location: {
                        degreesLatitude: mediaPayload.latitude,
                        degreesLongitude: mediaPayload.longitude,
                      },
                    };
                  } else if (mediaPayload.type === 'live_location') {
                    waContent = {
                      liveLocation: {
                        degreesLatitude: mediaPayload.latitude,
                        degreesLongitude: mediaPayload.longitude,
                      },
                    };
                  } else if (mediaPayload.type === 'contact') {
                    waContent = {
                      contacts: {
                        displayName: mediaPayload.displayName,
                        contacts: [{ vcard: mediaPayload.vcard }],
                      },
                    };
                  } else if (mediaPayload.type === 'poll') {
                    const pollMode = mapping.poll_sync_mode || 'native_sync';
                    if (
                      (pollMode === 'native_sync' || pollMode === 'native_no_vote') &&
                      mediaPayload.options?.length > 0
                    ) {
                      // Send native WhatsApp poll
                      waContent = {
                        poll: {
                          name: mediaPayload.question,
                          values: mediaPayload.options,
                          selectableCount: mediaPayload.allows_multiple_answers
                            ? mediaPayload.options.length
                            : 1,
                        },
                      };
                    } else if (pollMode === 'once_no_update') {
                      // Send short text once
                      waContent = {
                        text: `📊 [Poll: ${mediaPayload.question}]\nOptions: ${(mediaPayload.options || []).join(', ')}`,
                      };
                    } else {
                      // text_diagram: already in outboundWaText, use default text
                      waContent = { text: outboundWaText };
                    }
                  } else if (mediaPayload.url) {
                    if (mediaPayload.type === 'image') {
                      waContent = { image: { url: mediaPayload.url }, caption: outboundWaText };
                    } else if (mediaPayload.type === 'video') {
                      waContent = {
                        video: { url: mediaPayload.url },
                        caption: outboundWaText,
                        gifPlayback: Boolean(msg.animation),
                        ptv: Boolean(mediaPayload.ptv),
                      };
                    } else if (mediaPayload.type === 'audio') {
                      waContent = {
                        audio: mediaPayload.buffer
                          ? mediaPayload.buffer
                          : { url: mediaPayload.url },
                        mimetype: mediaPayload.mimetype || 'audio/ogg; codecs=opus',
                        ptt: Boolean(mediaPayload.ptt || msg.voice),
                      };
                    } else if (mediaPayload.type === 'sticker') {
                      waContent = {
                        sticker: { url: mediaPayload.url },
                      };
                    } else if (mediaPayload.type === 'document') {
                      waContent = {
                        document: { url: mediaPayload.url },
                        mimetype: mediaPayload.mimetype,
                        fileName: mediaPayload.fileName || 'file',
                        caption: outboundWaText,
                      };
                    }
                  }
                }

                let sentWaMsg = null;
                if (waContent.text && waContent.text.length > WHATSAPP_MAX_TEXT_LENGTH) {
                  const chunks = splitMessageText(waContent.text, WHATSAPP_MAX_TEXT_LENGTH);
                  for (let i = 0; i < chunks.length; i++) {
                    const sent = await session.sock.sendMessage(
                      mapping.wa_jid,
                      { text: chunks[i] },
                      i === 0 ? sendOptions : {}
                    );
                    if (i === 0) sentWaMsg = sent;
                  }
                } else if (
                  waContent.caption &&
                  waContent.caption.length > WHATSAPP_MAX_TEXT_LENGTH
                ) {
                  const chunks = splitMessageText(waContent.caption, WHATSAPP_MAX_TEXT_LENGTH);
                  waContent.caption = chunks[0];
                  sentWaMsg = await session.sock.sendMessage(
                    mapping.wa_jid,
                    waContent,
                    sendOptions
                  );
                  for (let i = 1; i < chunks.length; i++) {
                    await session.sock
                      .sendMessage(
                        mapping.wa_jid,
                        { text: chunks[i] },
                        sentWaMsg?.key?.id
                          ? { quoted: { key: { remoteJid: mapping.wa_jid, id: sentWaMsg.key.id } } }
                          : {}
                      )
                      .catch(() => null);
                  }
                } else {
                  sentWaMsg = await session.sock.sendMessage(
                    mapping.wa_jid,
                    waContent,
                    sendOptions
                  );
                }
                // For location/live_location: follow up with sender info as text (WA native pins carry no caption)
                if (
                  sentWaMsg &&
                  (mediaPayload?.type === 'location' || mediaPayload?.type === 'live_location') &&
                  outboundWaText.trim()
                ) {
                  await session.sock
                    .sendMessage(
                      mapping.wa_jid,
                      { text: outboundWaText.trim() },
                      sentWaMsg.key?.id
                        ? { quoted: { key: { remoteJid: mapping.wa_jid, id: sentWaMsg.key.id } } }
                        : {}
                    )
                    .catch(() => null);
                }
                if (mediaPayload && mediaPayload.type === 'sticker' && outboundWaText.trim()) {
                  await session.sock
                    .sendMessage(
                      mapping.wa_jid,
                      { text: outboundWaText.trim() },
                      sentWaMsg && sentWaMsg.key?.id
                        ? { quoted: { key: { remoteJid: mapping.wa_jid, id: sentWaMsg.key.id } } }
                        : {}
                    )
                    .catch(() => null);
                }
                if (sentWaMsg && sentWaMsg.key && sentWaMsg.key.id) {
                  recordMessageMap(
                    sentWaMsg.key.id,
                    tgChatId,
                    msg.message_id,
                    mapping.wa_jid,
                    true,
                    senderName,
                    '',
                    outboundWaText,
                    'tg'
                  );
                }
              } catch (waErr) {
                logger.error(
                  { error: waErr.message, waJid: mapping.wa_jid },
                  '❌ Error syncing Telegram message to WhatsApp'
                );
              }
            }
          }
        }
      } catch (err) {
        logger.warn(
          { error: err.message, botId: botConfig.id },
          '⚠️ Error polling Telegram updates'
        );
      }
    }
  } finally {
    isProcessingTelegramUpdates = false;
  }
}
