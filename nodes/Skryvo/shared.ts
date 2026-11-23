import type { ILoadOptions, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export const BASE_URL = 'https://api.skryvo.ai/api/v1/agent';

function listed(url: string, root: string, name: string, value: string): ILoadOptions {
	return {
		routing: {
			request: { method: 'GET', url },
			output: {
				postReceive: [
					{ type: 'rootProperty', properties: { property: root } },
					{ type: 'setKeyValue', properties: { name, value } },
					{ type: 'sort', properties: { key: 'name' } },
				],
			},
		},
	};
}

export const brandOptions = listed('/brands', 'brands', '={{$responseItem.name}}', '={{$responseItem.id}}');

export const channelOptions = listed(
	'/channels',
	'channels',
	'={{$responseItem.name + " (" + $responseItem.platform + ")"}}',
	'={{$responseItem.id}}',
);

export const platformOptions = listed(
	'/platforms',
	'platforms',
	'={{$responseItem.name}}',
	'={{$responseItem.platform}}',
);

type Show = { resource: string[]; operation: string[] };

export function shown(resource: string, operation: string): { show: Show } {
	return { show: { resource: [resource], operation: [operation] } };
}

/** A body field sent only when it has a value. */
export function bodyField(
	displayName: string,
	property: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties {
	return {
		displayName,
		name: property,
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property } },
		...extra,
	} as INodeProperties;
}

/** A comma-separated field sent as a list. */
export function listField(displayName: string, property: string, description: string): INodeProperties {
	return bodyField(displayName, property, {
		description,
		routing: {
			send: {
				type: 'body',
				property,
				value: '={{ $value.split(",").map(s => s.trim()).filter(s => s) }}',
			},
		},
	});
}

export function brandField(send: 'body' | 'query' = 'body'): INodeProperties {
	return {
		displayName: 'Brand Name or ID',
		name: 'brand_id',
		type: 'options',
		typeOptions: { loadOptions: brandOptions },
		default: '',
		description:
			'The brand to write as; the account\'s default brand when left out. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		routing: { send: { type: send, property: 'brand_id' } },
	};
}

export const PICTURES: INodeProperties = {
	displayName: 'Pictures',
	name: 'pictures',
	type: 'boolean',
	default: true,
	description: 'Whether to design a picture in the brand\'s kept look; spends image credits',
	routing: { send: { type: 'body', property: 'pictures' } },
};

export const CONFIRMED: INodeProperties = {
	displayName: 'Confirmed',
	name: 'confirmed',
	type: 'boolean',
	default: false,
	description:
		'Whether the person approved the summary an earlier call returned. Without it, a call that leaves a choice to the brand\'s defaults writes nothing and returns status "confirm" with the settings, cost and balance.',
	routing: { send: { type: 'body', property: 'confirmed' } },
};

export function idField(
	resource: string,
	operations: string[],
	displayName: string,
	name: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		required: true,
		default: '',
		description,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

export function op(
	name: string,
	value: string,
	action: string,
	description: string,
	routing: INodePropertyOptions['routing'],
): INodePropertyOptions {
	return { name, value, action, description, routing };
}

export const each = (root: string) => ({
	output: { postReceive: [{ type: 'rootProperty' as const, properties: { property: root } }] },
});
