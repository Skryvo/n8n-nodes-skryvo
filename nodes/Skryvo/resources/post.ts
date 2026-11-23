import type { INodeProperties } from 'n8n-workflow';
import {
	CONFIRMED,
	PICTURES,
	bodyField,
	brandField,
	channelOptions,
	each,
	idField,
	listField,
	op,
	platformOptions,
	shown,
} from '../shared';

const R = 'post';

export const postOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [R] } },
	default: 'writeDraft',
	options: [
		op('Cancel', 'cancel', 'Cancel a post', 'Cancel a scheduled post before it goes out', {
			request: { method: 'DELETE', url: '=/posts/{{$parameter.postId}}' },
			output: { postReceive: [{ type: 'set', properties: { value: '={{ { "cancelled": $parameter.postId } }}' } }] },
		}),
		op('Get Many', 'getMany', 'Get scheduled posts', 'Get scheduled and recent posts with their status', {
			request: { method: 'GET', url: '/posts' },
			...each('posts'),
		}),
		op('Review', 'review', 'Review a team post', 'Approve or send back a team post waiting for a reviewer', {
			request: { method: 'POST', url: '=/posts/{{$parameter.postId}}/review' },
		}),
		op(
			'Schedule',
			'schedule',
			'Schedule a post',
			'Schedule approved text to channels. Use it only after the person approved the draft.',
			{ request: { method: 'POST', url: '/posts' }, ...each('posts') },
		),
		op('Update', 'update', 'Update a post', 'Move a post not yet out to a new time, change its words, or both', {
			request: { method: 'PATCH', url: '=/posts/{{$parameter.postId}}' },
		}),
		op(
			'Write Draft',
			'writeDraft',
			'Write a draft post',
			'Draft posts in the brand\'s voice for up to four platforms. Schedules nothing.',
			{ request: { method: 'POST', url: '/drafts' } },
		),
	],
};

export const postFields: INodeProperties[] = [
	{
		displayName: 'Topic',
		name: 'topic',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Our new studio opens Saturday',
		description: 'What the post is about, up to 200 characters: the news, the offer, who it is for',
		displayOptions: shown(R, 'writeDraft'),
		routing: { send: { type: 'body', property: 'topic' } },
	},
	{
		displayName: 'Platform Names or IDs',
		name: 'platforms',
		type: 'multiOptions',
		typeOptions: { loadOptions: platformOptions },
		default: [],
		description:
			'Up to four. Left empty, the brand\'s platforms are used and the first call returns status "confirm". Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: shown(R, 'writeDraft'),
		routing: { send: { type: 'body', property: 'platforms' } },
	},
	{ ...CONFIRMED, displayOptions: shown(R, 'writeDraft') },
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'writeDraft'),
		options: [
			{ ...brandField(), displayName: 'Brand Name or ID' },
			bodyField('Audience', 'audience', { description: 'Who it is for' }),
			bodyField('Call to Action', 'call_to_action'),
			listField('Hashtags', 'hashtags', 'Comma-separated, up to ten'),
			bodyField('Language', 'language', { description: 'A language code such as en or de' }),
			bodyField('Link', 'link', { description: 'A web page the post points to' }),
			PICTURES,
			bodyField('Tone', 'tone', { description: 'For example friendly or professional' }),
		],
	},

	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'The exact words the person approved',
		displayOptions: shown(R, 'schedule'),
		routing: { send: { type: 'body', property: 'text' } },
	},
	{
		displayName: 'Channel Names or IDs',
		name: 'channel_ids',
		type: 'multiOptions',
		typeOptions: { loadOptions: channelOptions },
		required: true,
		default: [],
		description:
			'Connected channels to post to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: shown(R, 'schedule'),
		routing: { send: { type: 'body', property: 'channel_ids' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'schedule'),
		options: [
			bodyField('At', 'at', {
				type: 'dateTime',
				description:
					'When to publish; it moves to the next quarter hour. A time without an offset is read in the Skryvo calendar\'s time zone. Left out, in about five minutes.',
			}),
			{ ...brandField(), displayName: 'Brand Name or ID' },
			{
				displayName: 'Business Profile Button',
				name: 'button',
				type: 'options',
				default: 'learn_more',
				options: [
					{ name: 'Book', value: 'book' },
					{ name: 'Call', value: 'call' },
					{ name: 'Learn More', value: 'learn_more' },
					{ name: 'Order', value: 'order' },
					{ name: 'Shop', value: 'shop' },
					{ name: 'Sign Up', value: 'sign_up' },
				],
				description: 'Google Business Profile only. Call dials the profile\'s number, so leave Link out.',
				routing: { send: { type: 'body', property: 'button' } },
			},
			bodyField('By Channel (JSON)', 'by_channel', {
				type: 'json',
				default: '{}',
				description:
					'What is a channel\'s own, by channel ID: text, image_url, video_id, title, options, thread, poll, comments, tiktok, youtube. Send only what the channel\'s "can" lists.',
				routing: {
					send: {
						type: 'body',
						property: 'by_channel',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			}),
			bodyField('Image URL', 'image_url', { description: 'One picture for every channel' }),
			bodyField('Link', 'link', {
				description: 'A full web address: a Business Profile button, a pin\'s destination, else after the words',
			}),
			{
				displayName: 'TikTok Privacy',
				name: 'tiktokPrivacy',
				type: 'options',
				default: 'SELF_ONLY',
				description: 'Who can see a TikTok post. TikTok asks the person to choose it for every post.',
				options: [
					{ name: 'Followers', value: 'FOLLOWER_OF_CREATOR' },
					{ name: 'Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
					{ name: 'Only Me', value: 'SELF_ONLY' },
					{ name: 'Public', value: 'PUBLIC_TO_EVERYONE' },
				],
				routing: { send: { type: 'body', property: 'tiktok', value: '={{ { "privacy": $value } }}' } },
			},
		],
	},

	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 90 },
		default: 30,
		description: 'How many days ahead to include',
		displayOptions: shown(R, 'getMany'),
		routing: { send: { type: 'query', property: 'days' } },
	},

	idField(R, ['cancel', 'review', 'update'], 'Post ID', 'postId', 'The post\'s ID, from Schedule or Get Many'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: shown(R, 'update'),
		options: [
			bodyField('At', 'at', { type: 'dateTime', description: 'The new time; moves to a quarter hour' }),
			bodyField('Text', 'text', { typeOptions: { rows: 4 }, description: 'The new words' }),
		],
	},
	{
		displayName: 'Approve',
		name: 'approve',
		type: 'boolean',
		default: true,
		description: 'Whether to approve the post; off sends it back',
		displayOptions: shown(R, 'review'),
		routing: { send: { type: 'body', property: 'approve' } },
	},
	{
		displayName: 'Note',
		name: 'note',
		type: 'string',
		default: '',
		description: 'What should change, for the writer',
		displayOptions: shown(R, 'review'),
		routing: { send: { type: 'body', property: 'note' } },
	},
];
