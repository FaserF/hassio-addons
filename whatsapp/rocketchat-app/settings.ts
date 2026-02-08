import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export enum AppSetting {
  WhatsAppAddonUrl = 'whatsapp_addon_url',
  WhatsAppApiToken = 'whatsapp_api_token',
  WebhookToken = 'webhook_token',
  TargetRoomName = 'target_room_name',
}

export const settings: Array<ISetting> = [
  {
    id: AppSetting.WhatsAppAddonUrl,
    type: SettingType.STRING,
    packageValue: 'http://192.168.1.100:8066',
    required: true,
    public: false,
    i18nLabel: 'WhatsApp Addon URL',
    i18nDescription:
      'The internal IP and Port of your Home Assistant WhatsApp Addon (e.g., http://192.168.1.100:8066)',
  },
  {
    id: AppSetting.WhatsAppApiToken,
    type: SettingType.PASSWORD,
    packageValue: '',
    required: true,
    public: false,
    i18nLabel: 'WhatsApp API Token',
    i18nDescription: 'The API Token shown on the WhatsApp Addon Web UI.',
  },
  {
    id: AppSetting.WebhookToken,
    type: SettingType.PASSWORD,
    packageValue: '',
    required: true,
    public: false,
    i18nLabel: 'Local Webhook Token',
    i18nDescription: 'A secret token you define here and in the Addon config to secure the bridge.',
  },
  {
    id: AppSetting.TargetRoomName,
    type: SettingType.STRING,
    packageValue: 'general',
    required: true,
    public: false,
    i18nLabel: 'Target Room Name',
    i18nDescription: 'The name of the room where WhatsApp messages should be posted.',
  },
];
