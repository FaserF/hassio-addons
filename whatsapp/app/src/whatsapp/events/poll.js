import { getAggregateVotesInPollMessage, decryptPollVote } from '@whiskeysockets/baileys';
import { logger } from '../../logger.js';

/**
 * Normalizes JID to remove device suffix and ensure it has a domain.
 */
function normalizeJid(jid) {
  if (!jid) return '';
  const [userAndDevice, server] = jid.split('@');
  const user = userAndDevice.split(':')[0];
  return server ? `${user}@${server}` : `${user}@s.whatsapp.net`;
}

/**
 * Builds candidate JIDs from primary and secondary sources.
 */
function getJidCandidates(jid, altJid) {
  const candidates = new Set();
  if (jid) {
    const norm = normalizeJid(jid);
    if (norm) candidates.add(norm);
  }
  if (altJid) {
    const norm = normalizeJid(altJid);
    if (norm) candidates.add(norm);
  }
  return Array.from(candidates);
}

/**
 * Resolves encrypted poll votes to human-readable option names.
 */
export async function resolvePollVotes(pollUpdate, originalPoll, session) {
  const update = pollUpdate.message?.pollUpdateMessage;
  if (!update) return { vote: [], error: 'Missing pollUpdateMessage' };

  if (!originalPoll) {
    const pollCreationId = update.pollCreationMessageKey?.id;
    logger.warn(
      {
        pollCreationId: pollCreationId,
        sessionId: session.id,
        storeSize: session.messageStore?.size || 0,
      },
      'Poll vote received but original poll not found in store.'
    );
    return { vote: [], error: 'Original poll not in store' };
  }

  try {
    const meJid = normalizeJid(session.sock?.user?.id);
    const meLid = normalizeJid(session.sock?.user?.lid);
    const meCandidates = new Set();
    if (meJid) meCandidates.add(meJid);
    if (meLid) meCandidates.add(meLid);
    const meCandidatesArr = Array.from(meCandidates);

    const creatorCandidates = originalPoll.key.fromMe
      ? meCandidatesArr
      : getJidCandidates(
          originalPoll.key.participant || originalPoll.key.remoteJid,
          originalPoll.key.remoteJidAlt
        );
    const voterCandidates = pollUpdate.key.fromMe
      ? meCandidatesArr
      : getJidCandidates(
          pollUpdate.key.participant || pollUpdate.key.remoteJid,
          pollUpdate.key.remoteJidAlt
        );

    const pollEncKey =
      originalPoll.messageContextInfo?.messageSecret ||
      originalPoll.message?.messageContextInfo?.messageSecret;
    if (!pollEncKey) {
      throw new Error('Missing messageSecret for decryption');
    }

    let decryptedVote = null;
    let decryptionError = null;

    for (const creator of creatorCandidates) {
      for (const voter of voterCandidates) {
        try {
          decryptedVote = await decryptPollVote(update.vote, {
            pollEncKey,
            pollCreatorJid: creator,
            pollMsgId: originalPoll.key.id,
            voterJid: voter,
          });
          if (decryptedVote) {
            logger.debug(
              { creator, voter, sessionId: session.id },
              'Successfully decrypted poll vote with candidate combination.'
            );
            break;
          }
        } catch (err) {
          decryptionError = err;
        }
      }
      if (decryptedVote) break;
    }

    if (!decryptedVote) {
      throw decryptionError || new Error('Decryption returned no result');
    }

    const decryptedUpdate = {
      pollUpdateMessageKey: pollUpdate.key,
      vote: decryptedVote,
      senderTimestampMs: update.senderTimestampMs,
    };

    const votes = getAggregateVotesInPollMessage({
      message: originalPoll.message,
      pollUpdates: [decryptedUpdate],
    });

    return {
      vote: votes.filter((v) => v.voters.length > 0).map((v) => v.name),
      error: null,
    };
  } catch (err) {
    logger.error(
      {
        error: err.message,
        sessionId: session.id,
        pollCreationId: update.pollCreationMessageKey?.id,
      },
      'Failed to decrypt poll votes'
    );
    return { vote: [], error: `Decryption failed: ${err.message}` };
  }
}
