import type { INodeProperties } from 'n8n-workflow';
import { bodyField, brandField, channelOptions, idField, listField, op, platformOptions, shown } from '../shared';

const R = 'article';

export const articleOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [R] } },
	default: 'plan',
	options: [
		op('Check SEO', 'getSeo', 'Check an article\'s SEO', 'Run the free SEO check on a finished article', {
			request: { method: 'GET', url: '=/articles/{{$parameter.articleId}}/seo' },
		}),
		op('Get Results', 'getResults', 'Get an article\'s results', 'Every place an article went out, with its reach, engagement and search numbers', {
			request: { method: 'GET', url: '=/articles/{{$parameter.articleId}}/results' },
		}),
		op('Get Status', 'getStatus', 'Get an article\'s status', 'Writing with its stage, done with its text and checked claims, or failed', {
			request: { method: 'GET', url: '=/articles/{{$parameter.articleId}}' },
		}),
		op('Import', 'import', 'Import an article', 'Bring in the person\'s own article from text or a public address, free', {
			request: { method: 'POST', url: '/articles/import' },
		}),
		op('Improve', 'improve', 'Improve an article', 'Save an improved version: the first is free, each after costs one generation', {
			request: { method: 'POST', url: '=/articles/{{$parameter.articleId}}/improve' },
		}),
		op('Plan', 'plan', 'Plan an article', 'Plan an article for free: headline, outline, search phrase and questions only the person can answer', {
			request: { method: 'POST', url: '/articles/plan' },
		}),
		op('Publish', 'publish', 'Publish an article', 'Schedule a finished article to a blog channel, or send it there now as a draft. Use it only after the person approved the article.', {
			request: { method: 'POST', url: '=/articles/{{$parameter.articleId}}/publish' },
		}),
		op('Repurpose', 'repurpose', 'Repurpose an article into posts', 'Turn a finished article into one post per platform, ready to schedule; one generation', {
			request: { method: 'POST', url: '=/articles/{{$parameter.articleId}}/posts' },
		}),
		op('Write', 'write', 'Write a planned article', 'Write a plan in the background (two generations); follow it with Get Status', {
			request: { method: 'POST', url: '/articles' },
		}),
	],
};

export const articleFields: INodeProperties[] = [
	{
		displayName: 'Topic',
		name: 'topic',
		type: 'string',
		required: true,
		default: '',
		description: 'What the article is about, 3 to 200 characters',
		displayOptions: shown(R, 'plan'),
		routing: { send: { type: 'body', property: 'topic' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'plan'),
		options: [
			bodyField('Audience', 'audience'),
			brandField(),
			bodyField('Language', 'language', { description: 'A language code such as en or de' }),
			bodyField('Length', 'length', { type: 'number', default: 1500, description: 'Words, 100 to 4000' }),
			listField('Keywords', 'keywords', 'Comma-separated search phrases, up to ten'),
			listField('Must Cover', 'must_cover', 'Comma-separated points the article must make, up to eight'),
			bodyField('Notes', 'notes', { typeOptions: { rows: 3 } }),
			bodyField('Only You Know', 'only_you', {
				typeOptions: { rows: 3 },
				description: 'Facts only the person knows, used in their words',
			}),
			bodyField('Point of View', 'point_of_view', { description: 'first, second or third' }),
			listField('Sources', 'sources', 'Comma-separated addresses of up to three pages to read'),
			bodyField('Style', 'style', { description: 'For example how-to, listicle, comparison, case study, explainer' }),
			bodyField('Tone', 'tone'),
		],
	},

	{
		displayName: 'Plan ID',
		name: 'plan_id',
		type: 'string',
		required: true,
		default: '',
		description: 'The plan_id from Plan; it becomes the article\'s ID',
		displayOptions: shown(R, 'write'),
		routing: { send: { type: 'body', property: 'plan_id' } },
	},
	{
		displayName: 'Answers',
		name: 'answers',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'The person\'s answers to the plan\'s questions, up to three',
		displayOptions: shown(R, 'write'),
		options: [
			{
				displayName: 'Answer',
				name: 'answer',
				values: [
					{ displayName: 'Question', name: 'question', type: 'string', default: '' },
					{ displayName: 'Answer', name: 'answer', type: 'string', typeOptions: { rows: 2 }, default: '' },
				],
			},
		],
		routing: { send: { type: 'body', property: 'answers', value: '={{ $value.answer }}' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'write'),
		options: [
			bodyField('Audience', 'audience'),
			bodyField('Headline', 'headline', { description: 'One of the plan\'s headlines, or the person\'s own' }),
			bodyField('Inside Pictures', 'inside_pictures', { type: 'number', default: 0, description: '0 to 3' }),
			bodyField('Notes', 'notes', { typeOptions: { rows: 3 } }),
			bodyField('Pictures', 'pictures', { type: 'boolean', default: true, description: 'Whether to add a cover picture' }),
			bodyField('Point of View', 'point_of_view'),
			bodyField('Tone', 'tone'),
		],
	},

	idField(R, ['getSeo', 'getResults', 'getStatus', 'improve', 'publish', 'repurpose'], 'Article ID', 'articleId', 'The article_id from Write or Import, or a generation_id'),

	{
		displayName: 'Blog Channel Name or ID',
		name: 'channel_id',
		type: 'options',
		typeOptions: { loadOptions: channelOptions },
		required: true,
		default: '',
		description: 'A connected blog. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: shown(R, 'publish'),
		routing: { send: { type: 'body', property: 'channel_id' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'publish'),
		options: [
			bodyField('As Draft', 'as_draft', {
				type: 'boolean',
				default: true,
				description: 'Whether to send it to the blog now as a draft to review there',
			}),
			bodyField('At', 'at', { type: 'dateTime', description: 'When to publish; left out, in about five minutes' }),
			bodyField('Original URL', 'original_url', { description: 'The article\'s first home, credited by every copy' }),
		],
	},

	{
		displayName: 'Goal',
		name: 'goal',
		type: 'options',
		default: 'seo',
		options: [
			{ name: 'Accuracy', value: 'accuracy', description: 'Rewrite only the sentences the fact-check disputed' },
			{ name: 'Citations', value: 'geo_citations', description: 'Add a sourced FAQ' },
			{ name: 'SEO', value: 'seo', description: 'Fix what the SEO check found' },
		],
		displayOptions: shown(R, 'improve'),
		routing: { send: { type: 'body', property: 'goal' } },
	},

	{
		displayName: 'Platform Names or IDs',
		name: 'platforms',
		type: 'multiOptions',
		typeOptions: { loadOptions: platformOptions },
		required: true,
		default: [],
		description: 'One post per platform. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: shown(R, 'repurpose'),
		routing: { send: { type: 'body', property: 'platforms' } },
	},

	{
		displayName: 'Is Mine',
		name: 'is_mine',
		type: 'boolean',
		default: false,
		required: true,
		description: 'Whether the person says the article is theirs to publish; Skryvo refuses without it',
		displayOptions: shown(R, 'import'),
		routing: { send: { type: 'body', property: 'is_mine' } },
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		default: 'url',
		options: [
			{ name: 'Public Address', value: 'url' },
			{ name: 'Text', value: 'text' },
		],
		displayOptions: shown(R, 'import'),
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [R], operation: ['import'], source: ['url'] } },
		routing: { send: { type: 'body', property: 'url' } },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 8 },
		required: true,
		default: '',
		description: 'Markdown or HTML',
		displayOptions: { show: { resource: [R], operation: ['import'], source: ['text'] } },
		routing: { send: { type: 'body', property: 'text' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'import'),
		options: [brandField(), bodyField('Title', 'title')],
	},
];
