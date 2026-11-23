import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type IHttpRequestMethods,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';
import { BASE_URL } from '../Skryvo/shared';

const TOLERANCE_SECONDS = 300;

interface Saved extends IDataObject {
	webhookId?: string;
	secret?: string;
}

async function call(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	goneIsFine = false,
) {
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'skryvoApi', {
			method,
			url: `${BASE_URL}${path}`,
			body,
			json: true,
		});
	} catch (error) {
		const failed = new NodeApiError(this.getNode(), error as JsonObject);
		if (goneIsFine && failed.httpCode === '404') return undefined;
		throw failed;
	}
}

/** True when `header` holds a fresh v1 HMAC-SHA256 of "<t>.<raw body>" under `secret`. */
export function signed(raw: Buffer, header: string | undefined, secret: string, now: number): boolean {
	if (!header || !secret) return false;
	let t = NaN;
	const given: string[] = [];
	for (const part of header.split(',')) {
		const [key, value = ''] = part.trim().split('=', 2);
		if (key === 't') t = Number(value);
		if (key === 'v1' && value) given.push(value);
	}
	if (!Number.isFinite(t) || Math.abs(now - t) > TOLERANCE_SECONDS) return false;
	const expected = createHmac('sha256', secret).update(`${t}.`).update(raw).digest();
	return given.some((hex) => {
		const candidate = Buffer.from(hex, 'hex');
		return candidate.length === expected.length && timingSafeEqual(candidate, expected);
	});
}

export class SkryvoTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Skryvo Trigger',
		name: 'skryvoTrigger',
		icon: { light: 'file:../../icons/skryvo.svg', dark: 'file:../../icons/skryvo.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when a Skryvo post publishes or fails, or an article is ready',
		defaults: { name: 'Skryvo Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'skryvoApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['post.published'],
				options: [
					{ name: 'Article Failed', value: 'article.failed', description: 'An article could not be written' },
					{ name: 'Article Ready', value: 'article.ready', description: 'An article finished writing' },
					{ name: 'Post Failed', value: 'post.failed', description: 'A scheduled post did not go out' },
					{ name: 'Post Published', value: 'post.published', description: 'A scheduled post went live' },
					{ name: 'Results Ready', value: 'results.ready', description: 'New results were read for published work' },
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const saved = this.getWorkflowStaticData('node') as Saved;
				if (!saved.webhookId) return false;
				const listed = (await call.call(this, 'GET', '/webhooks')) as { webhooks?: IDataObject[] };
				const url = this.getNodeWebhookUrl('default');
				if ((listed.webhooks ?? []).some((hook) => hook.id === saved.webhookId && hook.url === url)) return true;
				delete saved.webhookId;
				delete saved.secret;
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const made = (await call.call(this, 'POST', '/webhooks', {
					url: this.getNodeWebhookUrl('default') as string,
					events: this.getNodeParameter('events') as string[],
				})) as { id?: string; secret?: string };
				if (!made.id || !made.secret) {
					throw new NodeApiError(this.getNode(), { message: 'Skryvo did not return the endpoint and its secret.' });
				}
				const saved = this.getWorkflowStaticData('node') as Saved;
				saved.webhookId = made.id;
				saved.secret = made.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const saved = this.getWorkflowStaticData('node') as Saved;
				if (saved.webhookId) {
					await call.call(this, 'DELETE', `/webhooks/${encodeURIComponent(saved.webhookId)}`, undefined, true);
				}
				delete saved.webhookId;
				delete saved.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const saved = this.getWorkflowStaticData('node') as Saved;
		const raw = (request as { rawBody?: Buffer }).rawBody;
		const now = Math.floor(Date.now() / 1000);
		const ok = raw !== undefined && signed(raw, request.header('skryvo-signature'), saved.secret ?? '', now);
		if (!ok) {
			this.getResponseObject().status(401).json({ error: 'The Skryvo-Signature header does not match.' });
			return { noWebhookResponse: true };
		}
		return { workflowData: [this.helpers.returnJsonArray(this.getBodyData())] };
	}
}
