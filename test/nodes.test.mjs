import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Skryvo } = require('../dist/nodes/Skryvo/Skryvo.node.js');
const { SkryvoTrigger, signed } = require('../dist/nodes/SkryvoTrigger/SkryvoTrigger.node.js');
const { SkryvoApi } = require('../dist/credentials/SkryvoApi.credentials.js');

const spec = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));
const PREFIX = '/api/v1/agent';
const WEBHOOK_ROUTES = new Set(['GET /webhooks', 'POST /webhooks', 'DELETE /webhooks/{}']);

const template = (path) => path.replace(/\{[^}]+\}/g, '{}');
const routeOf = (request) => `${request.method} ${template(request.url.replace(/^=/, '').replace(/\{\{[^}]+\}\}/g, '{x}'))}`;

function specOperation(route) {
	const [method, path] = route.split(' ');
	for (const [p, item] of Object.entries(spec.paths)) {
		if (template(p.slice(PREFIX.length)) === path && item[method.toLowerCase()]) return item[method.toLowerCase()];
	}
	return undefined;
}

function requestFields(op) {
	const ref = op.requestBody?.content?.['application/json']?.schema?.$ref;
	const body = ref ? Object.keys(spec.components.schemas[ref.split('/').pop()].properties) : [];
	const query = (op.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name);
	return { body: new Set(body), query: new Set(query) };
}

const properties = new Skryvo().description.properties;

function operationsOf(resource) {
	return properties.find((p) => p.name === 'operation' && p.displayOptions.show.resource.includes(resource)).options;
}

function sentBy(resource, operation) {
	const sent = [];
	const visit = (prop, inherited) => {
		const show = prop.displayOptions?.show ?? inherited;
		if (show && (!show.resource?.includes(resource) || !show.operation?.includes(operation))) return;
		if (prop.routing?.send) sent.push(prop.routing.send);
		for (const child of prop.options ?? []) if (child.name && child.type) visit(child, show);
	};
	for (const prop of properties) if (prop.displayOptions?.show?.operation) visit(prop);
	return sent;
}

test('every operation calls a route in the published spec and sends only its fields', () => {
	const resources = properties.find((p) => p.name === 'resource').options.map((o) => o.value);
	let checked = 0;
	for (const resource of resources) {
		for (const operation of operationsOf(resource)) {
			const route = routeOf(operation.routing.request);
			const op = specOperation(route);
			assert.ok(op, `${resource}.${operation.value} calls ${route}, which the spec lacks`);
			const allowed = requestFields(op);
			for (const send of sentBy(resource, operation.value)) {
				const where = send.type === 'query' ? allowed.query : allowed.body;
				assert.ok(where.has(send.property), `${resource}.${operation.value} sends ${send.type} "${send.property}", not in ${route}`);
			}
			assert.ok(operation.action, `${resource}.${operation.value} needs an action for agents`);
			checked++;
		}
	}
	assert.ok(checked >= 30, `only ${checked} operations`);
});

test('every required request field of a covered operation has a field in the node', () => {
	for (const resource of properties.find((p) => p.name === 'resource').options.map((o) => o.value)) {
		for (const operation of operationsOf(resource)) {
			const op = specOperation(routeOf(operation.routing.request));
			const ref = op.requestBody?.content?.['application/json']?.schema?.$ref;
			if (!ref) continue;
			const needed = spec.components.schemas[ref.split('/').pop()].required ?? [];
			const sent = new Set(sentBy(resource, operation.value).map((s) => s.property));
			for (const field of needed) assert.ok(sent.has(field), `${resource}.${operation.value} never sends required "${field}"`);
		}
	}
});

test('drafting schedules nothing, and scheduling is its own operation', () => {
	const posts = operationsOf('post');
	assert.equal(routeOf(posts.find((o) => o.value === 'writeDraft').routing.request), 'POST /drafts');
	assert.equal(routeOf(posts.find((o) => o.value === 'schedule').routing.request), 'POST /posts');
	assert.match(posts.find((o) => o.value === 'writeDraft').description, /Schedules nothing/);
	assert.match(posts.find((o) => o.value === 'schedule').description, /after the person approved/);
});

test('the credential sends the key as a Bearer token and is checked against /me', () => {
	const credential = new SkryvoApi();
	assert.equal(credential.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
	assert.equal(credential.test.request.url, '/me');
	assert.equal(credential.properties[0].typeOptions.password, true);
});

function hookContext({ saved = {}, answers = {}, events = ['post.published'] } = {}) {
	const calls = [];
	return {
		saved,
		calls,
		ctx: {
			getWorkflowStaticData: () => saved,
			getNodeWebhookUrl: () => 'https://n8n.example/webhook/abc',
			getNodeParameter: () => events,
			getNode: () => ({ name: 'Skryvo Trigger', type: 'skryvoTrigger', typeVersion: 1, parameters: {} }),
			helpers: {
				httpRequestWithAuthentication: async (credential, options) => {
					calls.push({ credential, ...options });
					const answer = answers[`${options.method} ${options.url}`];
					if (answer instanceof Error) throw answer;
					return answer ?? {};
				},
			},
		},
	};
}

test('activating the trigger subscribes its webhook URL to the chosen events and keeps the secret', async () => {
	const trigger = new SkryvoTrigger();
	const { ctx, saved, calls } = hookContext({
		events: ['post.published', 'article.ready'],
		answers: { [`POST https://api.skryvo.ai${PREFIX}/webhooks`]: { id: 'wh_1', url: 'https://n8n.example/webhook/abc', events: [], secret: 'whsec_1' } },
	});
	assert.equal(await trigger.webhookMethods.default.checkExists.call(ctx), false);
	assert.equal(await trigger.webhookMethods.default.create.call(ctx), true);
	assert.deepEqual(calls[0].body, { url: 'https://n8n.example/webhook/abc', events: ['post.published', 'article.ready'] });
	assert.equal(calls[0].credential, 'skryvoApi');
	assert.deepEqual(saved, { webhookId: 'wh_1', secret: 'whsec_1' });
});

test('checkExists finds the endpoint by id and URL, and forgets one Skryvo no longer has', async () => {
	const trigger = new SkryvoTrigger();
	const list = `GET https://api.skryvo.ai${PREFIX}/webhooks`;
	const live = hookContext({
		saved: { webhookId: 'wh_1', secret: 's' },
		answers: { [list]: { webhooks: [{ id: 'wh_1', url: 'https://n8n.example/webhook/abc' }] } },
	});
	assert.equal(await trigger.webhookMethods.default.checkExists.call(live.ctx), true);
	const gone = hookContext({ saved: { webhookId: 'wh_1', secret: 's' }, answers: { [list]: { webhooks: [] } } });
	assert.equal(await trigger.webhookMethods.default.checkExists.call(gone.ctx), false);
	assert.deepEqual(gone.saved, {});
});

test('deactivating unsubscribes, and an endpoint already gone is fine', async () => {
	const trigger = new SkryvoTrigger();
	const route = `DELETE https://api.skryvo.ai${PREFIX}/webhooks/wh_1`;
	const ok = hookContext({ saved: { webhookId: 'wh_1', secret: 's' } });
	assert.equal(await trigger.webhookMethods.default.delete.call(ok.ctx), true);
	assert.equal(`${ok.calls[0].method} ${ok.calls[0].url}`, route);
	assert.deepEqual(ok.saved, {});
	const notFound = Object.assign(new Error('Not Found'), { httpCode: '404', httpStatusCode: 404 });
	const gone = hookContext({ saved: { webhookId: 'wh_1', secret: 's' }, answers: { [route]: notFound } });
	assert.equal(await trigger.webhookMethods.default.delete.call(gone.ctx), true);
});

const BODY = JSON.stringify({ id: 'evt_1', type: 'post.published', created: '2026-11-23T10:00:00Z', data: { id: 'p1' } });
const header = (body, secret, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

test('signed accepts a fresh delivery signed with the secret and refuses anything else', () => {
	const t = 1_800_000_000;
	const raw = Buffer.from(BODY);
	assert.equal(signed(raw, header(BODY, 'whsec_1', t), 'whsec_1', t), true);
	assert.equal(signed(raw, `t=${t},v1=00,${header(BODY, 'whsec_1', t).split(',')[1]}`, 'whsec_1', t), true);
	assert.equal(signed(Buffer.from(BODY.replace('p1', 'p2')), header(BODY, 'whsec_1', t), 'whsec_1', t), false);
	assert.equal(signed(raw, header(BODY, 'whsec_2', t), 'whsec_1', t), false);
	assert.equal(signed(raw, header(BODY, 'whsec_1', t), 'whsec_1', t + 301), false);
	assert.equal(signed(raw, undefined, 'whsec_1', t), false);
});

function webhookContext(signature, secret) {
	const response = { code: 200, sent: undefined };
	return {
		response,
		ctx: {
			getRequestObject: () => ({ rawBody: Buffer.from(BODY), header: (name) => (name === 'skryvo-signature' ? signature : undefined) }),
			getResponseObject: () => ({
				status(code) {
					response.code = code;
					return this;
				},
				json(body) {
					response.sent = body;
				},
			}),
			getWorkflowStaticData: () => ({ webhookId: 'wh_1', secret }),
			getBodyData: () => JSON.parse(BODY),
			helpers: { returnJsonArray: (data) => [{ json: data }] },
		},
	};
}

test('a signed delivery starts the workflow with the event', async () => {
	const t = Math.floor(Date.now() / 1000);
	const { ctx } = webhookContext(header(BODY, 'whsec_1', t), 'whsec_1');
	const out = await new SkryvoTrigger().webhook.call(ctx);
	assert.equal(out.workflowData[0][0].json.type, 'post.published');
});

test('an unsigned or forged delivery gets 401 and starts nothing', async () => {
	const { ctx, response } = webhookContext('t=1,v1=00', 'whsec_1');
	const out = await new SkryvoTrigger().webhook.call(ctx);
	assert.deepEqual(out, { noWebhookResponse: true });
	assert.equal(response.code, 401);
});
