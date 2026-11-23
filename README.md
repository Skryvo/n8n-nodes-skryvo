# n8n-nodes-skryvo

Skryvo for [n8n](https://n8n.io): write posts, articles, emails, ads and listings in a brand's voice, design
their pictures, schedule them to the person's channels once approved, and start workflows when posts publish.

[Skryvo](https://skryvo.ai) is a hosted AI content platform. This package holds two nodes:

- **Skryvo**: every job below, as resources and operations. It can also be used as a tool by n8n's AI agents.
- **Skryvo Trigger**: starts a workflow when a post publishes or fails, an article is ready or failed, or new
  results are read. It subscribes its own webhook when the workflow is activated and removes it when deactivated.

Docs: https://skryvo.ai/docs/ · Skryvo is a paid service with a 7-day free trial on Hobby and Pro:
https://skryvo.ai/pricing/

## Install

In n8n: **Settings › Community Nodes › Install**, enter `n8n-nodes-skryvo`, and agree to the risks of community
nodes. On a self-hosted n8n you can also run `npm install n8n-nodes-skryvo` in `~/.n8n/nodes` and restart.
See [n8n's guide to installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. In Skryvo, open [Settings › API & agents](https://app.skryvo.ai/settings/agents) and create an API key. It
   starts with `sk_skryvo_` and is shown once.
2. In n8n, add a **Skryvo API** credential and paste the key. n8n checks it against Skryvo before saving.

The key acts in the workspace it was made in, with its holder's role there. Revoke it in Skryvo at any time.

## A first workflow in 60 seconds

1. **Skryvo** › Post › **Write Draft**: Topic `Our new studio opens Saturday`, Platforms `LinkedIn`, Confirmed on.
   Output:
   ```json
   {
     "status": "written",
     "brand_id": "bv_3c9d0e",
     "generation_id": "gen_5d1c9a",
     "posts": [{ "platform": "linkedin", "text": "Our new studio opens this Saturday in Leeds. #coffee", "hashtags": ["coffee"] }],
     "settings": [{ "field": "tone", "value": "friendly", "from": "brand" }]
   }
   ```
2. An approval step of your choice (a Wait node with a form, a message that waits for a reply).
3. **Skryvo** › Post › **Schedule**: Text `{{ $('Skryvo').item.json.posts[0].text }}`, Channels your LinkedIn
   page, At the time you want. Output: one item per channel, such as
   `{ "id": "c1a2b3c4d5", "platform": "linkedin", "date": "2026-11-24", "time": "09:00", "status": "scheduled" }`.
4. A **Skryvo Trigger** workflow on **Post Published** gets the post once it is live.

**Drafting never publishes.** Write Draft schedules nothing. When it leaves a choice to the brand's defaults (no
platforms given, for example) and Confirmed is off, Skryvo writes nothing and returns `status: "confirm"` with
each setting, where it came from, the cost and what is left this month; run it again with Confirmed on once the
person agrees. Schedule publishes exactly the text you pass, so pass only text the person approved.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| Account | Get, Get Balance | Who the key belongs to; generations, image credits and article plans left |
| Ad | Write | Ad variations per ad platform, within each one's limits; nothing runs |
| Article | Plan | A free plan: headline, outline, search phrase, questions only the person can answer |
| Article | Write | Writes a plan in the background (two generations); follow it with Get Status |
| Article | Get Status | Writing, done with the text and each checked claim, or failed |
| Article | Check SEO, Improve | The free SEO check; an improved version (first free, then one generation) |
| Article | Import | The person's own article from text or a public address, free |
| Article | Repurpose | One post per platform from a finished article |
| Article | Publish | Schedules a finished article to a blog, or sends it as a draft |
| Article | Get Results | Every place it went out, with reach, engagement and search numbers |
| Brand | Get Many, Get Design, Add | Brands; a brand's logo, colours, fonts and look; a new brand read from its website |
| Calendar | Plan, Accept | A week or month of topics; the rows the person keeps, none set to publish |
| Channel | Get Many, Get Platforms | Connected channels and what each takes; every platform Skryvo offers |
| Content | Find | Earlier articles, posts, emails, listings and ads |
| Email | Write | Subject lines, preheader, body and call to action; nothing is sent |
| Listing | Write | A marketplace listing from one to ten features |
| Picture | Design | One picture in the brand's kept look, sized per platform |
| Post | Write Draft, Schedule | Drafts in the brand's voice; schedules approved text to channels |
| Post | Get Many, Update, Review, Cancel | Scheduled posts; move or reword one; approve a team post; cancel one |
| Result | Get | Reach, engagement, best times and top posts over 7, 30 or 90 days |

Trigger events: Post Published, Post Failed, Article Ready, Article Failed, Results Ready. Each delivery is
checked against its `Skryvo-Signature` header (an HMAC-SHA256 with the endpoint's secret, at most five minutes
old); one that does not match gets a 401 and starts nothing. A test delivery from Skryvo carries `"test": true`.

Writing posts with pictures, designing a picture and planning an article take Skryvo about a minute. n8n gives a
node's request 300 seconds, so these operations wait for the answer in the node itself.

For an agent route without an operation here (changing a brand's look, saving defaults, uploading a video), use
n8n's **HTTP Request** node with the predefined **Skryvo API** credential and the base URL
`https://api.skryvo.ai/api/v1/agent`.

## Errors

Skryvo's refusals come back as the node's error with Skryvo's own sentence, for example "This needs 2
generations and 1 are left this month." Turn on **Continue On Fail** to route them. A 401 means the key was
revoked; 429 means more than 60 requests a minute or 1000 an hour for the key.

## Compatibility

Built with `@n8n/node-cli` 0.57 against n8n's node API version 1. No runtime dependencies.

## Contributing

```bash
npm install
npm run lint   # n8n's community node linter
npm test       # builds, then checks every operation against test/openapi.json and the trigger offline
npm run dev    # runs n8n locally with these nodes
```

`test/openapi.json` is Skryvo's published API description (`https://api.skryvo.ai/openapi.json`). The tests
fail when an operation calls a route the description lacks, sends a field its request does not have, or leaves
out a required one. To follow a new version of the API, replace the file and run `npm test`.

Releases are published from GitHub Actions with npm provenance (`.github/workflows/publish.yml`) when a version
tag is pushed.

Issues: https://github.com/Skryvo/n8n-nodes-skryvo/issues · support@skryvo.ai

## License

MIT © Flutter Studio LLC
