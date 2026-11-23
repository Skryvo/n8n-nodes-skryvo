import type { INodeProperties } from 'n8n-workflow';
import { CONFIRMED, bodyField, brandField, each, listField, op, platformOptions, shown } from '../shared';

function operations(resource: string, fallback: string, options: INodeProperties['options']): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		default: fallback,
		options,
	};
}

function more(resource: string, operation: string, options: INodeProperties[]): INodeProperties {
	return {
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(resource, operation),
		options,
	};
}

function required(
	resource: string,
	operation: string,
	displayName: string,
	property: string,
	description: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties {
	return {
		...bodyField(displayName, property, { description, ...extra }),
		required: true,
		displayOptions: shown(resource, operation),
	} as INodeProperties;
}

export const accountOperations = operations('account', 'get', [
	op('Get', 'get', 'Get the account', 'Who the key belongs to and the plan', { request: { method: 'GET', url: '/me' } }),
	op('Get Balance', 'getBalance', 'Get the balance', 'Generations, image credits and article plans left this month', {
		request: { method: 'GET', url: '/balance' },
	}),
]);

export const brandOperations = operations('brand', 'getMany', [
	op('Add', 'add', 'Add a brand', 'Add a brand read from its website, in the background; uses one voice training', {
		request: { method: 'POST', url: '/brands' },
	}),
	op('Get Design', 'getDesign', 'Get a brand\'s design', 'The brand\'s logo, colours, fonts, kept look and own photos', {
		request: { method: 'GET', url: '/design' },
	}),
	op('Get Many', 'getMany', 'Get brands', 'Every brand the key can use', {
		request: { method: 'GET', url: '/brands' },
		...each('brands'),
	}),
]);

export const brandFields: INodeProperties[] = [
	required('brand', 'add', 'Name', 'name', 'The brand\'s name'),
	required('brand', 'add', 'Website', 'website', 'The brand\'s website, read to learn its voice'),
	{ ...brandField('query'), displayOptions: shown('brand', 'getDesign') },
];

export const channelOperations = operations('channel', 'getMany', [
	op('Get Many', 'getMany', 'Get connected channels', 'Connected channels with what each takes ("can")', {
		request: { method: 'GET', url: '/channels' },
		...each('channels'),
	}),
	op('Get Platforms', 'getPlatforms', 'Get platforms', 'Every platform Skryvo can post to, connected or not', {
		request: { method: 'GET', url: '/platforms' },
		...each('platforms'),
	}),
]);

export const pictureOperations = operations('picture', 'design', [
	op('Design', 'design', 'Design a picture', 'Design one picture in the brand\'s kept look, sized for each platform; spends image credits', {
		request: { method: 'POST', url: '/pictures' },
	}),
]);

export const pictureFields: INodeProperties[] = [
	required('picture', 'design', 'Text', 'text', 'The post\'s text; the picture carries its opening line', {
		typeOptions: { rows: 4 },
	}),
	{
		displayName: 'Platform Names or IDs',
		name: 'platforms',
		type: 'multiOptions',
		typeOptions: { loadOptions: platformOptions },
		required: true,
		default: [],
		description: 'A copy sized for each. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: shown('picture', 'design'),
		routing: { send: { type: 'body', property: 'platforms' } },
	},
	more('picture', 'design', [
		brandField(),
		bodyField('Direction', 'direction', { description: 'closer, bolder, calmer, or the person\'s own words' }),
		bodyField('Headline', 'headline', { description: 'Up to nine words on the picture' }),
		bodyField('Photo ID', 'photo_id', { description: 'One of the brand\'s own photos, from Get Design' }),
	]),
];

export const emailOperations = operations('email', 'write', [
	op('Write', 'write', 'Write an email', 'Write subject lines, a preheader, the body and a call to action in the brand\'s voice; nothing is sent', {
		request: { method: 'POST', url: '/emails' },
	}),
]);

export const emailFields: INodeProperties[] = [
	required('email', 'write', 'About', 'about', 'What the email is about', { typeOptions: { rows: 3 } }),
	{ ...CONFIRMED, displayOptions: shown('email', 'write') },
	more('email', 'write', [
		bodyField('Audience', 'audience'),
		brandField(),
		bodyField('Call to Action', 'call_to_action'),
		{
			displayName: 'Email Type',
			name: 'email_type',
			type: 'options',
			default: 'promotional',
			options: [
				{ name: 'Announcement', value: 'announcement' },
				{ name: 'Follow Up', value: 'follow_up' },
				{ name: 'Newsletter', value: 'newsletter' },
				{ name: 'Promotional', value: 'promotional' },
				{ name: 'Re-Engagement', value: 're_engagement' },
				{ name: 'Transactional', value: 'transactional' },
				{ name: 'Welcome', value: 'welcome' },
			],
			routing: { send: { type: 'body', property: 'email_type' } },
		},
		bodyField('Language', 'language'),
		bodyField('Length', 'length', { type: 'number', default: 250, description: 'Body words, 100 to 1000' }),
		bodyField('Tone', 'tone'),
	]),
];

export const listingOperations = operations('listing', 'write', [
	op('Write', 'write', 'Write a product listing', 'Write a title, description and feature bullets for a marketplace', {
		request: { method: 'POST', url: '/listings' },
	}),
]);

export const listingFields: INodeProperties[] = [
	required('listing', 'write', 'Product', 'product', 'The product\'s name'),
	{
		...listField('Features', 'features', 'Comma-separated, one to ten: materials, size, what it does, who it is for'),
		required: true,
		displayOptions: shown('listing', 'write'),
	},
	{ ...CONFIRMED, displayOptions: shown('listing', 'write') },
	more('listing', 'write', [
		bodyField('Audience', 'audience'),
		brandField(),
		bodyField('Keywords', 'keywords'),
		bodyField('Language', 'language'),
		{
			displayName: 'Marketplace',
			name: 'marketplace',
			type: 'options',
			default: 'shopify',
			options: [
				{ name: 'Amazon', value: 'amazon' },
				{ name: 'eBay', value: 'ebay' },
				{ name: 'Etsy', value: 'etsy' },
				{ name: 'Google Shopping', value: 'google_shopping' },
				{ name: 'Landing Page', value: 'landing_page' },
				{ name: 'SaaS', value: 'saas' },
				{ name: 'Shopify', value: 'shopify' },
				{ name: 'TikTok Shop', value: 'tiktok_shop' },
				{ name: 'Walmart', value: 'walmart' },
				{ name: 'WooCommerce', value: 'woocommerce' },
			],
			routing: { send: { type: 'body', property: 'marketplace' } },
		},
		bodyField('Overview', 'overview', { typeOptions: { rows: 3 } }),
		bodyField('Price', 'price', { type: 'number', default: 0 }),
		bodyField('Tone', 'tone'),
	]),
];

export const adOperations = operations('ad', 'write', [
	op('Write', 'write', 'Write ad copy', 'Write ad variations per ad platform, each within its limits; nothing runs', {
		request: { method: 'POST', url: '/ads' },
	}),
]);

export const adFields: INodeProperties[] = [
	required('ad', 'write', 'Product', 'product', 'What the ad sells'),
	{
		...listField('Ad Platforms', 'platforms', 'Comma-separated, for example google_ads; a wrong name is refused with the right ones'),
		required: true,
		displayOptions: shown('ad', 'write'),
	},
	more('ad', 'write', [
		listField('Benefits', 'benefits', 'Comma-separated, up to five'),
		brandField(),
		bodyField('Goal', 'goal', { default: 'conversion' }),
		bodyField('Language', 'language', { default: 'en' }),
		bodyField('Link', 'link'),
		bodyField('Variations', 'variations', { type: 'number', default: 3, description: '1 to 6' }),
		bodyField('What It Is', 'what_it_is', { typeOptions: { rows: 3 } }),
	]),
];

export const calendarOperations = operations('calendar', 'plan', [
	op('Accept', 'accept', 'Accept plan rows', 'Add the rows the person keeps as planned topics, none set to publish', {
		request: { method: 'POST', url: '/calendar/accept' },
	}),
	op('Plan', 'plan', 'Plan a calendar', 'Plan a week or a month of topics (one generation); adds nothing until accepted', {
		request: { method: 'POST', url: '/calendar/plan' },
	}),
]);

export const calendarFields: INodeProperties[] = [
	required('calendar', 'plan', 'Start Date', 'start_date', 'The first day, YYYY-MM-DD'),
	{
		displayName: 'Period',
		name: 'period',
		type: 'options',
		default: 'week',
		options: [
			{ name: 'Month', value: 'month' },
			{ name: 'Week', value: 'week' },
		],
		displayOptions: shown('calendar', 'plan'),
		routing: { send: { type: 'body', property: 'period' } },
	},
	more('calendar', 'plan', [
		brandField(),
		listField('Platforms', 'platforms', 'Comma-separated platform names'),
		listField('Topics', 'topics', 'Comma-separated, up to ten'),
	]),
	{
		displayName: 'Items (JSON)',
		name: 'items',
		type: 'json',
		required: true,
		default: '[]',
		description: 'The rows the person keeps, from Plan\'s items; each needs date, time, content_type and topic',
		displayOptions: shown('calendar', 'accept'),
		routing: {
			send: { type: 'body', property: 'items', value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}' },
		},
	},
];

export const contentOperations = operations('content', 'find', [
	op('Find', 'find', 'Find earlier work', 'Earlier articles, posts, emails, listings and ads, newest first', {
		request: { method: 'GET', url: '/content' },
		...each('items'),
	}),
]);

export const contentFields: INodeProperties[] = [
	{
		displayName: 'Kind',
		name: 'kind',
		type: 'options',
		default: 'article',
		options: [
			{ name: 'Ad', value: 'ad' },
			{ name: 'Article', value: 'article' },
			{ name: 'Email', value: 'email' },
			{ name: 'Listing', value: 'listing' },
			{ name: 'Post', value: 'post' },
		],
		displayOptions: shown('content', 'find'),
		routing: { send: { type: 'query', property: 'kind' } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: shown('content', 'find'),
		routing: { send: { type: 'query', property: 'limit' } },
	},
];

export const resultsOperations = operations('results', 'get', [
	op('Get', 'get', 'Get post results', 'Reach, engagement, best times and top posts', {
		request: { method: 'GET', url: '/results' },
	}),
]);

export const resultsFields: INodeProperties[] = [
	{
		displayName: 'Days',
		name: 'days',
		type: 'options',
		default: 30,
		options: [
			{ name: '7 Days', value: 7 },
			{ name: '30 Days', value: 30 },
			{ name: '90 Days', value: 90 },
		],
		displayOptions: shown('results', 'get'),
		routing: { send: { type: 'query', property: 'days' } },
	},
	{ ...brandField('query'), displayOptions: shown('results', 'get') },
];
