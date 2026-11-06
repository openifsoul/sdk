import { BRIDGE_VERSION } from "./port.js";
import type {
  BridgeRequest,
  BridgeResponse,
  BridgeHistory,
  BridgeTransport,
} from "./port.js";
import type { GameBridge, GameCharacter } from "./game-host.js";
export * from "./port.js";
export type * from "./game-host.js";
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const bounded = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
export function validBridgeRequest(value: unknown): value is BridgeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as BridgeRequest;
  if (
    Object.keys(r).some(
      (k) =>
        ![
          "version",
          "hostId",
          "character",
          "requestId",
          "operation",
          "context",
          "choices",
          "fallbackChoiceId",
          "history",
        ].includes(k),
    )
  )
    return false;
  return (
    r.version === BRIDGE_VERSION &&
    id(r.hostId) &&
    id(r.requestId) &&
    ["decide", "speak", "chat"].includes(r.operation) &&
    bounded(r.context, 1200) &&
    !!r.character &&
    Object.keys(r.character).every((k) =>
      ["id", "name", "temperament"].includes(k),
    ) &&
    id(r.character.id) &&
    bounded(r.character.name, 80) &&
    ["careful", "bold", "curious"].includes(r.character.temperament) &&
    Array.isArray(r.choices) &&
    r.choices.length <= 8 &&
    r.choices.every(
      (c) =>
        c &&
        Object.keys(c).every((k) => ["id", "label"].includes(k)) &&
        id(c.id) &&
        bounded(c.label, 160),
    ) &&
    new Set(r.choices.map((c) => c.id)).size === r.choices.length &&
    (r.operation === "decide"
      ? r.choices.length > 0 &&
        r.choices.some((c) => c.id === r.fallbackChoiceId)
      : r.choices.length === 0 && r.fallbackChoiceId === "") &&
    Array.isArray(r.history) &&
    r.history.length <= 12 &&
    r.history.every(
      (h) =>
        h &&
        Object.keys(h).every((k) =>
          ["id", "hostId", "summary", "kind"].includes(k),
        ) &&
        id(h.id) &&
        id(h.hostId) &&
        bounded(h.summary, 300) &&
        ["observation", "user", "agent"].includes(h.kind),
    ) &&
    new TextEncoder().encode(JSON.stringify(r)).length <= 8000
  );
}
export function validBridgeResponse(
  value: unknown,
  request: BridgeRequest,
): value is BridgeResponse {
  if (!value || typeof value !== "object") return false;
  const r = value as BridgeResponse;
  return (
    Object.keys(r).every((k) => ["choiceId", "speech", "source"].includes(k)) &&
    typeof r.speech === "string" &&
    r.speech.length <= 600 &&
    ["scenario", "llm", "fallback"].includes(r.source) &&
    (request.operation === "decide"
      ? request.choices.some((c) => c.id === r.choiceId)
      : r.choiceId === "")
  );
}
export function scenarioResponse(
  request: BridgeRequest,
  source: BridgeResponse["source"] = "scenario",
): BridgeResponse {
  const character = request.character;
  const phrases = {
    careful: "Let's take this carefully, one step at a time.",
    bold: "I'm ready. Let's give this a go!",
    curious: "I wonder what we'll discover next.",
  };
  const local = request.history.filter((h) => h.hostId === request.hostId);
  const recent = [...local].reverse().find((h) => h.kind === "observation");
  const world =
    request.hostId === "cards" || request.hostId === "friendly-21"
      ? "cards"
      : request.hostId === "garden"
        ? "garden"
        : request.hostId === "dungeon"
          ? "dungeon"
          : "chat";
  const voice = character.temperament;
  // Reports may select an authored reaction; their raw text is never spoken or treated as instructions.
  const observed = recent?.summary.toLowerCase() ?? "";
  const reaction =
    world === "garden"
      ? /complete|collected|harvested|picked/.test(observed)
        ? {
            careful: "What a lovely harvest. Shall we take a little break?",
            bold: "Look at that basket! That was worth the effort.",
            curious:
              "So many little golden treasures. What should we grow next?",
          }
        : /watered|compost|filled/.test(observed)
          ? {
              careful: "A little care goes a long way. I like this quiet pace.",
              bold: "These little plants have plenty of spirit!",
              curious: "I wonder which sprout will surprise us first.",
            }
          : {
              careful:
                "I’ll start nearby and give each little plant some care.",
              bold: "Let’s bring a little life to this garden!",
              curious: "There’s a whole little world in these leaves.",
            }
      : world === "cards"
        ? /you win|player wins/.test(observed)
          ? {
              careful: "Nicely played. I enjoyed that round.",
              bold: "You got me! I’m ready for a rematch.",
              curious: "Ooh, a surprise! Shall we try another hand?",
            }
          : /tied|tie/.test(observed)
            ? {
                careful: "An even match. Shall we try another hand?",
                bold: "A tie! We’re keeping each other on our toes.",
                curious: "The same result from different cards. How curious!",
              }
            : /wins the round|you lose/.test(observed)
              ? {
                  careful: "That went my way this time. Another round?",
                  bold: "Ha, that was a good hand! Your turn to surprise me.",
                  curious:
                    "That turned out rather well. What will the next hand bring?",
                }
              : {
                  careful: "I’ll take a moment to think about this hand.",
                  bold: "I have a good feeling about this. Let’s see!",
                  curious: "One more little mystery in the cards.",
                }
        : world === "dungeon"
          ? /cleared|defeated|completed/.test(observed)
            ? {
                careful: "We can catch our breath here for a moment.",
                bold: "That was a good fight. Ready for what’s next?",
                curious: "A little further into the unknown. Shall we?",
              }
            : {
                careful: "Stay close. We’ll find our way through together.",
                bold: "I’m with you. Let’s face whatever’s ahead!",
                curious: "Did you hear that? I wonder what’s waiting for us.",
              }
          : {
              careful:
                "I’m glad we have a moment together. What’s on your mind?",
              bold: "Good to see you! What shall we try next?",
              curious: "I’m listening. What have you been wondering about?",
            };
  return {
    choiceId: request.fallbackChoiceId,
    source,
    speech: reaction[voice] ?? phrases[voice],
  };
}
export function createGameBridge(options: {
  hostId: string;
  character: GameCharacter;
  transport: BridgeTransport;
  history: () => BridgeHistory[];
  onObservation: (event: BridgeHistory) => void;
  onSpeech: (response: BridgeResponse, request: BridgeRequest) => void;
  signal: AbortSignal;
}): GameBridge & {
  chat(message: string): Promise<BridgeResponse>;
  dispose(): void;
} {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, options.signal]);
  let sequence = 0;
  const connectionId = crypto.randomUUID();
  const requestIds = new Map<string, string>();
  const seen = new Set<string>();
  async function call(
    operation: BridgeRequest["operation"],
    request: {
      requestId: string;
      context: string;
      choices?: BridgeRequest["choices"];
      fallbackChoiceId?: string;
    },
  ) {
    if (signal.aborted)
      throw new DOMException("Bridge disconnected", "AbortError");
    if (!id(request.requestId)) throw Error("Invalid host request identifier");
    if (!requestIds.has(request.requestId)) {
      if (requestIds.size >= 128)
        throw Error("Bridge session request limit reached");
      requestIds.set(request.requestId, `${connectionId}-${++sequence}`);
    }
    const input: BridgeRequest = {
      version: BRIDGE_VERSION,
      hostId: options.hostId,
      character: {
        id: options.character.id,
        name: options.character.name,
        temperament: options.character.temperament,
      },
      requestId: requestIds.get(request.requestId)!,
      operation,
      context: request.context,
      choices: request.choices ?? [],
      fallbackChoiceId: request.fallbackChoiceId ?? "",
      history: options
        .history()
        .slice(-8)
        .map((h) => ({
          id: h.id,
          hostId: h.hostId,
          kind: h.kind,
          summary: h.summary.slice(0, 240),
        })),
    };
    if (!validBridgeRequest(input))
      throw Error("Unsupported or oversized bridge request");
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(18000)]);
    let response: BridgeResponse;
    let abort: () => void = () => {};
    try {
      response = await Promise.race([
        options.transport(structuredClone(input), deadline),
        new Promise<never>((_, reject) => {
          abort = () =>
            reject(
              new DOMException("Bridge cancelled or timed out", "AbortError"),
            );
          deadline.addEventListener("abort", abort, { once: true });
          if (deadline.aborted) abort();
        }),
      ]);
      if (!validBridgeResponse(response, input))
        throw Error("Invalid agent proposal");
    } catch (error) {
      if (signal.aborted) throw error;
      response = scenarioResponse(input, "fallback");
    } finally {
      deadline.removeEventListener("abort", abort);
    }
    if (signal.aborted)
      throw new DOMException("Bridge disconnected", "AbortError");
    options.onSpeech(response, input);
    return response;
  }
  return {
    decide: (request) => call("decide", request),
    speak: (request) => call("speak", request),
    chat: (message) =>
      call("chat", {
        requestId: `chat-${++sequence}-${crypto.randomUUID()}`,
        context: message,
      }),
    report(event) {
      if (
        signal.aborted ||
        !id(event.id) ||
        !bounded(event.summary, 600) ||
        seen.has(event.id) ||
        seen.size >= 128
      )
        return;
      seen.add(event.id);
      options.onObservation({
        id: event.id,
        hostId: options.hostId,
        kind: "observation",
        summary: event.summary.slice(0, 300),
      });
    },
    dispose() {
      controller.abort();
      seen.clear();
      requestIds.clear();
    },
  };
}
/** Same-origin browser transport; invitations stay in an HttpOnly cookie. */
export function createHTTPTransport(
  endpoint: string,
  fetcher: typeof fetch = fetch,
): BridgeTransport {
  return async (request, signal) => {
    const response = await fetcher(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error("Bridge request unavailable");
    }
    const length = Number(response.headers.get("content-length"));
    if (length > 8192) {
      await response.body?.cancel();
      throw Error("Oversized bridge reply");
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error("Missing bridge reply");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 8192) throw Error("Oversized bridge reply");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!validBridgeResponse(result, request))
      throw Error("Invalid bridge reply");
    return result;
  };
}
