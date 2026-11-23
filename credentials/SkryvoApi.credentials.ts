import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SkryvoApi implements ICredentialType {
	name = 'skryvoApi';

	displayName = 'Skryvo API';

	icon: Icon = { light: 'file:../icons/skryvo.svg', dark: 'file:../icons/skryvo.dark.svg' };

	documentationUrl = 'https://skryvo.ai/docs/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'sk_skryvo_…',
			description:
				'Create a key in Skryvo under Settings › API & agents. It is shown once and acts in the workspace it was made in.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.skryvo.ai/api/v1/agent',
			url: '/me',
		},
	};
}
