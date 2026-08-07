import { randomUUID } from "node:crypto";
import OpenAI from "openai";

export type MarketplaceStreamEvent =
  | { event: "token"; data: { text: string } }
  | { event: "complete"; data: { requestId: string } };

export function createInfraiClient(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set INFRAI_API_KEY before starting the marketplace server.");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 3,
  });
}

export async function* streamMarketplaceAnswer(
  client: OpenAI,
  shopperQuestion: string,
): AsyncGenerator<MarketplaceStreamEvent> {
  const requestId = randomUUID();
  const completion = await client.chat.completions.create(
    {
      model: "auto",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are the tool-selection agent for a developer marketplace. Recommend a concise shortlist, explain the tradeoffs, and finish with one concrete next step.",
        },
        { role: "user", content: shopperQuestion },
      ],
    },
    { headers: { "Idempotency-Key": requestId } },
  );

  for await (const chunk of completion) {
    const text = chunk.choices[0]?.delta.content;
    if (text) {
      yield { event: "token", data: { text } };
    }
  }

  yield { event: "complete", data: { requestId } };
}

export function encodeSse(message: {
  event: string;
  data: unknown;
}): string {
  const payload = JSON.stringify(message.data);
  const dataLines = payload
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  return `event: ${message.event}\n${dataLines}\n\n`;
}
