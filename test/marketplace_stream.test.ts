import assert from "node:assert/strict";
import test from "node:test";
import { encodeSse } from "../src/marketplace_stream.ts";

test("encodes one complete SSE event with JSON data", () => {
  const encoded = encodeSse({
    event: "token",
    data: { text: "First line\nSecond line" },
  });

  assert.equal(
    encoded,
    'event: token\ndata: {"text":"First line\\nSecond line"}\n\n',
  );
});
