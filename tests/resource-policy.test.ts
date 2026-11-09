import assert from "node:assert/strict";
import test from "node:test";
import {
  createHTTPTransport,
  validBridgeRequest,
  bridgeCapabilities,
  DEFAULT_BRIDGE_LIMITS,
  BridgeBudgetError,
  resolveBridgeLimits,
} from "../src/bridge.js";
import type { BridgeRequest } from "../src/bridge.js";
const request: BridgeRequest = {
  version: "ifsoul-bridge/0.4.0",
  hostId: "original-host",
  requestId: "r1",
  character: { id: "companion", name: "Mira", temperament: "careful" },
  operation: "chat",
  context: "A bounded question.",
  choices: [],
  fallbackChoiceId: "",
  history: [],
};
const high = { maxRequestBytes: 65536, maxContextChars: 40000 };

test("32KB request requires explicit host limits and runtime server capability before POST", async () => {
  const large = { ...request, context: "x".repeat(32768) };
  assert.equal(validBridgeRequest(large), false);
  assert.equal(validBridgeRequest(large, high), true);
  const calls: string[] = [];
  const transport = createHTTPTransport(
    "https://example.test/api/bridge",
    async (url, init) => {
      calls.push(`${init?.method}:${url}`);
      if (init?.method === "GET")
        return Response.json({ bridge: bridgeCapabilities(high) });
      assert.equal(JSON.parse(String(init?.body)).context.length, 32768);
      return Response.json({
        choiceId: "",
        speech: "Original reply",
        source: "llm",
      });
    },
    { limits: high }
  );
  assert.equal(
    (await transport(large, new AbortController().signal)).source,
    "llm"
  );
  assert.deepEqual(calls, [
    "GET:https://example.test/api/resource-policy",
    "POST:https://example.test/api/bridge",
  ]);
});

test("default-budget transport does not negotiate; absent or lower capability rejects increased envelope without POST", async () => {
  let posts = 0;
  const legacy = createHTTPTransport("/api/bridge", async (_url, init) => {
    posts++;
    assert.equal(init?.method, "POST");
    return Response.json({ choiceId: "", speech: "Reply", source: "scenario" });
  });
  await legacy(request, new AbortController().signal);
  assert.equal(posts, 1);
  const large = { ...request, context: "x".repeat(32768) };
  for (const missing of [true, false]) {
    const transport = createHTTPTransport(
      "/api/bridge",
      async (_url, init) => {
        assert.equal(init?.method, "GET");
        return missing
          ? new Response("", { status: 404 })
          : Response.json({ bridge: bridgeCapabilities() });
      },
      { limits: high }
    );
    await assert.rejects(
      transport(large, new AbortController().signal),
      (error: unknown) =>
        error instanceof BridgeBudgetError &&
        (error.code === "unsupported-policy" ||
          error.code === "budget-exceeded")
    );
  }
});

test("buffered 1GiB policy is explicitly unsupported without allocation; unknown fields cannot bypass", () => {
  assert.throws(
    () => resolveBridgeLimits({ maxRequestBytes: 1024 ** 3 }),
    (error: unknown) =>
      error instanceof BridgeBudgetError && error.code === "unsupported-policy"
  );
  assert.throws(
    () => resolveBridgeLimits({ untrusted: 100 } as never),
    /configuration/
  );
  assert.equal(DEFAULT_BRIDGE_LIMITS.maxRequestBytes, 8000);
  assert.equal(DEFAULT_BRIDGE_LIMITS.timeoutMs, 18000);
  assert.equal(validBridgeRequest({ ...request, resourcePolicy: high }), false);
});

test("HTTP declared and chunked response overflow cancels before accumulating the complete body", async () => {
  let cancelled = 0,
    pulls = 0;
  const declared = createHTTPTransport(
    "/api/bridge",
    async () =>
      new Response(
        new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls++;
              controller.enqueue(new Uint8Array(16));
            },
            cancel() {
              cancelled++;
            },
          },
          { highWaterMark: 0 }
        ),
        { headers: { "content-length": "10000" } }
      )
  );
  await assert.rejects(
    declared(request, new AbortController().signal),
    (error: unknown) =>
      error instanceof BridgeBudgetError &&
      error.code === "budget-exceeded" &&
      error.layer === "http-response" &&
      error.field === "maxResponseBytes"
  );
  assert.equal(pulls, 0);
  assert.equal(cancelled, 1);
  const chunked = createHTTPTransport(
    "/api/bridge",
    async () =>
      new Response(
        new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls++;
              controller.enqueue(new Uint8Array(512));
            },
            cancel() {
              cancelled++;
            },
          },
          { highWaterMark: 0 }
        )
      ),
    { limits: { maxResponseBytes: 1000 } }
  );
  await assert.rejects(
    chunked(request, new AbortController().signal),
    (error: unknown) =>
      error instanceof BridgeBudgetError &&
      error.code === "budget-exceeded" &&
      error.layer === "http-response" &&
      error.field === "maxResponseBytes"
  );
  assert.equal(pulls, 2);
  assert.equal(cancelled, 2);
});

test("HTTP body cancellation returns even when the injected fetch/body ignores abort or has a hanging cancel", async () => {
  let cancelled = 0;
  const abort = new AbortController();
  const transport = createHTTPTransport(
    "/api/bridge",
    async () =>
      new Response(
        new ReadableStream<Uint8Array>(
          {
            pull() {
              return new Promise(() => {});
            },
            cancel() {
              cancelled++;
              return new Promise(() => {});
            },
          },
          { highWaterMark: 0 }
        )
      )
  );
  const pending = transport(request, abort.signal);
  const timer = setTimeout(() => abort.abort(), 10);
  try {
    await assert.rejects(
      pending,
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError"
    );
  } finally {
    clearTimeout(timer);
  }
  assert.equal(cancelled, 1);
});

test("an already-cancelled HTTP request never invokes even an abort-ignoring injected fetch", async () => {
  let calls = 0;
  const abort = new AbortController();
  abort.abort();
  const transport = createHTTPTransport("/api/bridge", async () => {
    calls++;
    return Response.json({ choiceId: "", speech: "Late", source: "llm" });
  });
  await assert.rejects(
    transport(request, abort.signal),
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError"
  );
  assert.equal(calls, 0);
});
