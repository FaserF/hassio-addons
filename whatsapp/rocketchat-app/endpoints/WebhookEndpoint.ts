import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import {
    ApiEndpoint,
    IApiEndpointInfo,
    IApiRequest,
    IApiResponse,
} from '@rocket.chat/apps-engine/definition/api';
import { AppSetting } from '../settings';

export class WebhookEndpoint extends ApiEndpoint {
    public path = 'webhook';

    public async post(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        const token = await read.getEnvironmentReader().getSettings().getValueById(AppSetting.WebhookToken);

        // Validate Token
        if (request.headers['x-webhook-token'] !== token) {
            return this.json({ status: 401, content: { error: 'Invalid Token' } });
        }

        const { sender, content, is_group } = request.content;
        const targetRoomName = await read.getEnvironmentReader().getSettings().getValueById(AppSetting.TargetRoomName);
        const room = await read.getRoomReader().getByName(targetRoomName);

        if (!room) {
            return this.json({ status: 404, content: { error: 'Room not found' } });
        }

        const messageBuilder = modify.getCreator().startMessage();
        messageBuilder.setRoom(room);

        const senderLabel = is_group ? `[WA Group] ${sender}` : `[WA] ${sender}`;
        messageBuilder.setText(`*${senderLabel}*: ${content}`);

        await modify.getCreator().finish(messageBuilder);

        return this.json({ status: 200, content: { success: true } });
    }
}
