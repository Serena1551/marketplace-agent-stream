import { createReadStream } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import {
  createInfraiClient,
  encodeSse,
  streamMarketplaceAnswer,
} from "./marketplace_stream.ts";

const marketplacePage = fileURLToPath(
  new URL("../public/marketplace.html", import.meta.url),
);
const client = createInfraiClient();

function sendJsonError(response: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unexpected stream error";
  response.write(encodeSse({ event: "error", data: { message } }));
  response.end();
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(marketplacePage).pipe(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/recommendations") {
    const question = url.searchParams.get("question")?.trim();
    if (!question) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("A question is required.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    response.flushHeaders();

    try {
      for await (const event of streamMarketplaceAnswer(client, question)) {
        response.write(encodeSse(event));
      }
      response.end();
    } catch (error) {
      sendJsonError(response, error);
    }
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Marketplace ready at http://localhost:${port}`);
});
