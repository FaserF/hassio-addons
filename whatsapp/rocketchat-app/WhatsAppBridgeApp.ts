import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ApiVisibility, ApiSecurity } from '@rocket.chat/apps-engine/definition/api';
import { AppSetting, settings } from './settings';
import { WebhookEndpoint } from './endpoints/WebhookEndpoint';

export class WhatsAppBridgeApp extends App implements IPostMessageSent {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        // Add settings
        await Promise.all(settings.map((s) => configuration.settings.provideSetting(s)));

        // Add API Endpoint
        await configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE, // We handle security via Token in the endpoint
            endpoints: [new WebhookEndpoint(this)],
        });
    }

    public async checkPostMessageSent?(message: IMessage, read: IRead, http: IHttp): Promise<boolean> {
        // Prevent infinite loops and only handle messages in the target room
        const targetRoomName = await read.getEnvironmentReader().getSettings().getValueById(AppSetting.TargetRoomName);
        return (
            message.room.slug === targetRoomName &&
            !message.sender.bot &&
            !!message.text &&
            !message.text.startsWith('[WA]')
        );
    }

    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ): Promise<void> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(AppSetting.WhatsAppAddonUrl);
        const token = await read.getEnvironmentReader().getSettings().getValueById(AppSetting.WhatsAppApiToken);

        if (!url || !token) {
            this.getLogger().error('WhatsApp Addon URL or Token not configured');
            return;
        }

        // Logic: Try to parse [Number] at the start of message or use a default contact
        let targetNumber = '';
        let cleanText = message.text || '';

        const match = cleanText.match(/^\[(\d+)\]\s*(.*)/);
        if (match) {
            targetNumber = match[1];
            cleanText = match[2];
        }

        if (!targetNumber) {
            this.getLogger().debug('No target number found in message prefix [number]. Skipping WhatsApp forward.');
            return;
        }

        try {
            await http.post(`${url}/send_message`, {
                headers: {
                    'X-Auth-Token': token,
                    'Content-Type': 'application/json',
                },
                data: {
                    number: targetNumber,
                    message: cleanText,
                },
            });
        } catch (e) {
            this.getLogger().error('Failed to send message to WhatsApp Addon:', e);
        }
    }
}
