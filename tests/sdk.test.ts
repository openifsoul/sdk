import assert from "node:assert/strict";
import test from "node:test";
import {
  BRIDGE_VERSION,
  createGameBridge,
  createHTTPTransport,
  scenarioResponse,
  validBridgeRequest,
  validBridgeResponse,
  type BridgeHistory,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeTransport,
} from "../src/index.js";

const character = { id: "seed", name: "Seed", temperament: "curious" as const };
const decision = {
  requestId: "request-1",
  context: "Choose a whole bed to tend.",
  choices: [
    { id: "near", label: "Near bed" },
    { id: "far", label: "Far bed" },
  ],
  fallbackChoiceId: "near",
};
const request = (): BridgeRequest => ({
  version: BRIDGE_VERSION,
  hostId: "garden",
  character,
  operation: "decide",
  history: [],
  ...structuredClone(decision),
});
const reply: BridgeResponse = {
  choiceId: "far",
  speech: "I will tend the far bed.",
  source: "llm",
};
function setup(transport: BridgeTransport) {
  const observations: BridgeHistory[] = [];
  const speeches: BridgeResponse[] = [];
  const controller = new AbortController();
  const bridge = createGameBridge({
    hostId: "garden",
    character,
    transport,
    signal: controller.signal,
    history: () => observations,
    onObservation: (event) => observations.push(event),
    onSpeech: (response) => speeches.push(response),
  });
  return { bridge, observations, speeches, controller };
}

test("requests reject incompatible versions, ambiguous choices and oversized context/history", () => {
  assert.equal(validBridgeRequest(request()), true);
  const invalid: unknown[] = [
    { ...request(), version: "ifsoul-bridge/9" },
    { ...request(), command: "move" },
    { ...request(), choices: [] },
    { ...request(), choices: [decision.choices[0], decision.choices[0]] },
    { ...request(), fallbackChoiceId: "teleport" },
    { ...request(), context: "x".repeat(1201) },
    { ...request(), character: { ...character, privateMemory: "secret" } },
    {
      ...request(),
      choices: Array.from({ length: 9 }, (_, i) => ({
        id: `choice-${i}`,
        label: "Bed",
      })),
    },
    {
      ...request(),
      history: Array.from({ length: 13 }, (_, i) => ({
        id: `event-${i}`,
        hostId: "garden",
        summary: "Watered",
        kind: "observation",
      })),
    },
    { ...request(), operation: "speak" },
  ];
  for (const input of invalid) assert.equal(validBridgeRequest(input), false);
  const unicode = request();
  unicode.context = "🌱".repeat(600);
  unicode.history = Array.from({ length: 12 }, (_, i) => ({
    id: `event-${i}`,
    hostId: "garden",
    summary: "🌱".repeat(150),
    kind: "observation",
  }));
  assert.equal(
    validBridgeRequest(unicode),
    false,
    "wire byte budget must apply beyond character counts",
  );
  assert.equal(
    validBridgeRequest({
      ...request(),
      operation: "chat",
      choices: [],
      fallbackChoiceId: "",
    }),
    true,
  );
});

test("responses cannot introduce commands, unknown choices or oversized speech", () => {
  assert.equal(validBridgeResponse(reply, request()), true);
  for (const invalid of [
    { ...reply, choiceId: "teleport" },
    { ...reply, speech: "x".repeat(601) },
    { ...reply, source: "pretend-llm" },
    { ...reply, action: "walk" },
  ])
    assert.equal(validBridgeResponse(invalid, request()), false);
  assert.equal(
    validBridgeResponse(
      { ...reply, choiceId: "" },
      { ...request(), operation: "speak", choices: [], fallbackChoiceId: "" },
    ),
    true,
  );
});

test("scenario speech is deterministic, contextual and keeps report wording private", () => {
  const input = {
    ...request(),
    operation: "chat" as const,
    choices: [],
    fallbackChoiceId: "",
    history: [
      {
        id: "report-1",
        hostId: "garden",
        kind: "observation" as const,
        summary: "Two plants watered.",
      },
    ],
  };
  assert.deepEqual(
    scenarioResponse(input),
    scenarioResponse(structuredClone(input)),
  );
  assert.equal(scenarioResponse(input).source, "scenario");
  assert.match(scenarioResponse(input).speech, /sprout/);
  assert.doesNotMatch(
    scenarioResponse(input).speech,
    /host|report|Two plants watered/i,
  );
  const contaminated = {
    ...input,
    history: [
      {
        ...input.history[0],
        hostId: "another-world",
        summary: "Two plants watered. PRIVATE_MARKER",
      },
    ],
  };
  assert.doesNotMatch(scenarioResponse(contaminated).speech, /PRIVATE_MARKER/);
  assert.equal(
    scenarioResponse(contaminated).speech,
    scenarioResponse({ ...input, history: [] }).speech,
  );
  assert.doesNotMatch(
    scenarioResponse(input, "fallback").speech,
    /host|report/i,
  );
  assert.equal(scenarioResponse(input, "fallback").source, "fallback");
});

test("unknown provider choice becomes explicit safe fallback, not an invented completion", async () => {
  const { bridge, speeches, observations } = setup(async () => ({
    ...reply,
    choiceId: "delete-world",
  }));
  try {
    const result = await bridge.decide(decision);
    assert.equal(result.choiceId, "near");
    assert.equal(result.source, "fallback");
    assert.equal(speeches.length, 1);
    assert.equal(observations.length, 0);
  } finally {
    bridge.dispose();
  }
});

test("disposal cancels a pending transport that ignores signals and suppresses late speech", async () => {
  let finish!: (response: BridgeResponse) => void;
  const { bridge, speeches } = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = bridge.decide(decision);
  bridge.dispose();
  await assert.rejects(pending, { name: "AbortError" });
  finish(reply);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(speeches, []);
  await assert.rejects(bridge.decide(decision), { name: "AbortError" });
});

test("external disconnect cancels pending work without delivering a fallback callback", async () => {
  const { bridge, controller, speeches } = setup(() => new Promise(() => {}));
  try {
    const pending = bridge.decide(decision);
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.deepEqual(speeches, []);
  } finally {
    bridge.dispose();
  }
});

test("host observations deduplicate by identity, bound retained text and stop after dispose", () => {
  const { bridge, observations } = setup(async () => reply);
  bridge.report({
    id: "water-1",
    summary: "Watered one plant.",
    kind: "progress",
  });
  bridge.report({
    id: "water-1",
    summary: "All plants harvested.",
    kind: "outcome",
  });
  bridge.report({ id: "not valid", summary: "ignored" });
  bridge.report({ id: "too-large", summary: "x".repeat(601) });
  bridge.report({ id: "bounded", summary: "x".repeat(400) });
  assert.equal(observations.length, 2);
  assert.equal(observations[0].summary, "Watered one plant.");
  assert.equal(observations[1].summary.length, 300);
  assert.ok(
    observations.every(
      (event) => event.kind === "observation" && event.hostId === "garden",
    ),
  );
  bridge.dispose();
  bridge.report({ id: "late", summary: "late" });
  assert.equal(observations.length, 2);
});

function fetchReply(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}
test("HTTP transport rejects declared and streamed oversized replies before parsing", async () => {
  const controller = new AbortController();
  await assert.rejects(
    createHTTPTransport(
      "/bridge",
      fetchReply(new Response("{}", { headers: { "content-length": "8193" } })),
    )(request(), controller.signal),
    /Oversized/,
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(5000));
      c.enqueue(new Uint8Array(4000));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    createHTTPTransport("/bridge", fetchReply(new Response(stream)))(
      request(),
      controller.signal,
    ),
    /Oversized/,
  );
  assert.equal(
    cancelled,
    true,
    "oversized streaming reply releases its reader",
  );
});

test("HTTP transport validates parsed JSON and sends a same-origin bounded request", async () => {
  const controller = new AbortController();
  let captured: RequestInit | undefined;
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    captured = init;
    return new Response(JSON.stringify(reply));
  }) as typeof fetch;
  assert.deepEqual(
    await createHTTPTransport("/bridge", fetcher)(request(), controller.signal),
    reply,
  );
  assert.equal(captured?.credentials, "same-origin");
  assert.equal(captured?.method, "POST");
  assert.deepEqual(JSON.parse(captured?.body as string), request());
  for (const body of [
    "invalid json",
    JSON.stringify({ ...reply, choiceId: "unknown" }),
    JSON.stringify({ ...reply, speech: "x".repeat(601) }),
  ]) {
    await assert.rejects(
      createHTTPTransport("/bridge", fetchReply(new Response(body)))(
        request(),
        controller.signal,
      ),
    );
  }
  await assert.rejects(
    createHTTPTransport(
      "/bridge",
      fetchReply(new Response("unavailable", { status: 503 })),
    )(request(), controller.signal),
    /unavailable/,
  );
});

test("invalid requests never reach transport or produce dialogue", async () => {
  let calls = 0;
  const { bridge, speeches } = setup(async () => {
    calls++;
    return reply;
  });
  try {
    await assert.rejects(
      bridge.decide({ ...decision, context: "x".repeat(1201) }),
      /oversized/,
    );
    await assert.rejects(
      bridge.decide({ ...decision, fallbackChoiceId: "unknown" }),
      /Unsupported/,
    );
    assert.equal(calls, 0);
    assert.deepEqual(speeches, []);
  } finally {
    bridge.dispose();
  }
});

test("bridge projects decorated catalog characters and UI history into the strict wire contract", async () => {
  const decoratedCharacter = {
    ...character,
    description: "UI-only catalog biography",
    selected: true,
  };
  const decoratedHistory = {
    id: "watered-1",
    hostId: "garden",
    kind: "observation" as const,
    summary: "One plant watered.",
    source: "scenario",
    displayLabel: "Earlier garden visit",
  };
  let sent: BridgeRequest | undefined;
  const bridge = createGameBridge({
    hostId: "garden",
    character: decoratedCharacter,
    history: () => [decoratedHistory],
    signal: new AbortController().signal,
    onObservation() {},
    onSpeech() {},
    transport: async (input) => {
      sent = input;
      assert.equal(validBridgeRequest(input), true);
      return reply;
    },
  });
  try {
    assert.deepEqual(await bridge.decide(decision), reply);
    assert.ok(sent);
    assert.deepEqual(sent.character, character);
    assert.deepEqual(sent.history, [
      {
        id: decoratedHistory.id,
        hostId: decoratedHistory.hostId,
        kind: decoratedHistory.kind,
        summary: decoratedHistory.summary,
      },
    ]);
    assert.equal(JSON.stringify(sent).includes("UI-only"), false);
    assert.equal(JSON.stringify(sent).includes("displayLabel"), false);
    assert.equal(
      decoratedCharacter.description,
      "UI-only catalog biography",
      "projection must preserve caller-owned metadata",
    );
    assert.equal(decoratedHistory.source, "scenario");
  } finally {
    bridge.dispose();
  }
});

test("host retry IDs remain stable within a connection and are isolated after reconnect", async () => {
  const wireIds: string[] = [];
  const make = () =>
    createGameBridge({
      hostId: "garden",
      character: { id: "mira", name: "Mira", temperament: "careful" },
      transport: async (r) => {
        wireIds.push(r.requestId);
        return scenarioResponse(r);
      },
      history: () => [],
      onObservation: () => {},
      onSpeech: () => {},
      signal: new AbortController().signal,
    });
  const first = make(),
    second = make();
  const decision = {
    requestId: "watering-order",
    context: "Choose an order.",
    choices: [{ id: "near", label: "Near first" }],
    fallbackChoiceId: "near",
  };
  try {
    await first.decide(decision);
    await first.decide(decision);
    await second.decide(decision);
    assert.equal(wireIds[0], wireIds[1]);
    assert.notEqual(wireIds[0], wireIds[2]);
  } finally {
    first.dispose();
    second.dispose();
  }
});
