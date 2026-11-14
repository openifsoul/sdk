import assert from "node:assert/strict";
import test from "node:test";
import {
  BRIDGE_VERSION,
  IFSOUL_VERSION,
  createGameBridge,
  scenarioResponse,
  validBridgeRequest,
} from "../src/bridge.js";
test("current writer rejects obsolete or unknown request versions without retry", async () => {
  {
    const sent: string[] = [];
    const bridge = createGameBridge({
      hostId: "external",
      character: { id: "original", name: "Original", temperament: "curious" },
      transport: async (request) => {
        sent.push(request.version);
        assert(validBridgeRequest(request));
        for (const version of [
          "ifsoul-bridge/0.1",
          "ifsoul-bridge/0.3.0",
          "ifsoul-app-memory/0.4.0",
        ])
          assert(!validBridgeRequest({ ...request, version }));
        assert(
          !validBridgeRequest({ ...request, version: "ifsoul-bridge/9.9" }),
        );
        return scenarioResponse(request);
      },
      history: () => [],
      onObservation: () => {},
      onSpeech: () => {},
      signal: new AbortController().signal,
    });
    await bridge.decide({
      requestId: "move",
      context: "Choose.",
      choices: [{ id: "wait", label: "Wait" }],
      fallbackChoiceId: "wait",
    });
    assert.deepEqual(sent, [BRIDGE_VERSION]);
    bridge.dispose();
  }
  assert.equal(IFSOUL_VERSION, "0.6.0");
});

test("old server rejects a current request with actionable error and no hidden fallback/retry", async () => {
  const { createHTTPTransport, BridgeRequestError } =
    await import("../src/bridge.js");
  let posts = 0;
  const transport = createHTTPTransport(
    "https://example.test/api/bridge",
    async () => {
      posts++;
      return Response.json(
        { ok: false, error: { code: "invalid-request" } },
        { status: 400 },
      );
    },
  );
  const bridge = createGameBridge({
    hostId: "external",
    character: { id: "original", name: "Original", temperament: "curious" },
    transport,
    history: () => [],
    onObservation: () => {},
    onSpeech: () => {},
    signal: new AbortController().signal,
  });
  try {
    await assert.rejects(bridge.chat("Hello"), BridgeRequestError);
    assert.equal(posts, 1);
  } finally {
    bridge.dispose();
  }
});

test("HTTP400 explicit version error is distinct from invalid request and malformed legacy response", async () => {
  const { createHTTPTransport } = await import("../src/bridge.js");
  const request = {
    version: BRIDGE_VERSION,
    hostId: "original",
    requestId: "one",
    character: { id: "original", name: "Original", temperament: "curious" },
    operation: "chat" as const,
    context: "Hello",
    choices: [],
    fallbackChoiceId: "",
    history: [],
  };
  for (const [response, code] of [
    [
      Response.json(
        { error: { code: "unsupported-version" } },
        { status: 400 },
      ),
      "unsupported-version",
    ],
    [
      Response.json({ error: { code: "invalid-request" } }, { status: 400 }),
      "request-rejected",
    ],
    [
      new Response("Old server rejected the request", { status: 400 }),
      "request-rejected",
    ],
  ] as const) {
    let calls = 0;
    const transport = createHTTPTransport(
      "https://example.test/api/bridge",
      async () => {
        calls++;
        return response;
      },
    );
    await assert.rejects(
      transport(request, new AbortController().signal),
      (e) => (e as { code: string }).code === code,
    );
    assert.equal(calls, 1);
  }
});

test("definite authentication/policy/conflict rejections never become fallback speech", async () => {
  const { createHTTPTransport, BridgeRequestError } =
    await import("../src/bridge.js");
  for (const status of [401, 403, 409]) {
    let speech = 0;
    const bridge = createGameBridge({
      hostId: "host",
      character: { id: "original", name: "Original", temperament: "quiet" },
      transport: createHTTPTransport(
        "https://example.test/api/bridge",
        async () => Response.json({ error: { code: "policy" } }, { status }),
      ),
      history: () => [],
      onObservation: () => {},
      onSpeech: () => {
        speech++;
      },
      signal: new AbortController().signal,
    });
    try {
      await assert.rejects(bridge.chat("A request"), BridgeRequestError);
      assert.equal(speech, 0);
    } finally {
      bridge.dispose();
    }
  }
});
