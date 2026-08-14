// Facade re-exporter for modularized Moderation Engine
export {
  gt,
  _TRANSLATION_MAP,
  recordTranslationMap,
  deleteTranslationIfExists,
  updateTranslationIfExists,
} from './engine/translations.js';

export {
  isSelfParticipant,
  generateBotWelcomeMessage,
  sendMissingAdminWarning,
  executePenalty,
  issueUserWarning,
  clearUserWarnings,
} from './engine/penalties.js';

export {
  pendingCaptchas,
  recentKickReasons,
  cleanCaptchaInput,
  findPendingCaptcha,
  clearPendingCaptcha,
  isUserVerified,
  setUserCaptchaVerification,
  getGroupCaptchaUsers,
  handlePrivateCaptchaMessage,
} from './engine/captcha.js';

export { SPAM_INVITE_LINK_PATTERNS, userFloodMap, groupJoinMap } from './engine/filters.js';

export {
  formatMessageTemplate,
  participantEventDeduper,
  clearParticipantEventDeduper,
  handleModerationParticipantUpdate,
} from './engine/participants.js';

export { handleModerationMessage } from './engine/pipeline.js';
