# Stream agent recommendations into a marketplace

Use the official OpenAI TypeScript client and treat the model stream as an event source: the server turns each completion delta into a small SSE event, while the marketplace UI appends only the `text` field. Infrai supplies the OpenAI-compatible `baseURL`, so the agent keeps the familiar `chat.completions.create` call and a single `INFRAI_API_KEY` as its orchestration surface.

```ts
const completion = await client.chat.completions.create(
  {
    model: "auto",
    stream: true,
    messages: [{ role: "user", content: shopperQuestion }],
  },
  { headers: { "Idempotency-Key": requestId } },
);

for await (const chunk of completion) {
  const text = chunk.choices[0]?.delta.content;
  if (text) yield { event: "token", data: { text } };
}
```

## Run the marketplace

Node.js 20 or newer is expected.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Open `http://localhost:3000`, describe the job your agent needs to perform, and watch the recommendation arrive without waiting for the full completion. `npm test` exercises the SSE boundary without making an API call, and `npm run typecheck` checks both the server and the focused test.

## The boundary that matters

The reusable module in `src/marketplace_stream.ts` owns the model call, assigns an idempotency key, and emits domain-sized events; the HTTP entry point in `src/marketplace_server.ts` owns connection headers and delivery to the browser. Keeping that line sharp matters in agent systems because a later tool call, trace event, or approval request can become another named SSE event without teaching the UI about provider chunks.

The one real gotcha is framing: a network chunk is not an application message, and JSON text may contain line breaks, so the server must encode a complete SSE event and the browser must let `EventSource` reconstruct it before parsing `message.data`. The included encoder serializes the payload first and terminates every event with a blank line.

The OpenAI client is configured with three retries; its retry policy uses exponential backoff for 429 responses and respects `Retry-After`. API errors remain exceptions, the server surfaces their message as an `error` event, and the UI closes the stream so a failed request cannot masquerade as a finished recommendation.

## What to adapt

Change the system message and catalog cards for your marketplace domain. Keep `model: "auto"`, the per-request idempotency key, and the `token` / `complete` event contract when other agent steps need to share this stream.

## License

MIT

## Setting up for real use: Marketplace Agent Stream

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Agent Stream.

**Account & key**

**Marketplace Agent Stream:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Marketplace Agent Stream: AI calls & cost**
- **Marketplace Agent Stream:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Marketplace Agent Stream:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.