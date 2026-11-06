import { BRIDGE_VERSION } from "./port.js";
import type {
  BridgeRequest,
  BridgeResponse,
  BridgeHistory,
  BridgeTransport,
} from "./port.js";
import type { GameBridge, GameCharacter } from "./host-port.js";
export * from "./port.js";
export type * from "./host-port.js";
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const bounded = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const languageTag = (value: unknown): value is string => {
  if (!bounded(value, 64)) return false;
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
};
const validAttribution = (value: {
  actor?: unknown;
  observer?: unknown;
  recipient?: unknown;
  actorCharacterId?: unknown;
  actorCharacterName?: unknown;
  reportedClaims?: unknown;
  perspectiveCharacterId?: unknown;
}) =>
  (value.perspectiveCharacterId === undefined ||
    id(value.perspectiveCharacterId)) &&
  (value.reportedClaims === undefined ||
    (Array.isArray(value.reportedClaims) &&
      value.reportedClaims.length <= 4 &&
      value.reportedClaims.every(
        (claim) =>
          claim !== null &&
          typeof claim === "object" &&
          !Array.isArray(claim) &&
          Object.keys(claim).every((key) =>
            ["subject", "key", "value"].includes(key)
          ) &&
          ["actor", "recipient"].includes(claim.subject) &&
          ["role", "preference"].includes(claim.key) &&
          bounded(claim.value, 160)
      ))) &&
  (value.actorCharacterId === undefined || id(value.actorCharacterId)) &&
  (value.actorCharacterName === undefined ||
    bounded(value.actorCharacterName, 80)) &&
  [value.actor, value.observer, value.recipient].every(
    (role) =>
      role === undefined ||
      ["user", "agent", "host", "unknown"].includes(role as string)
  );
export function validBridgeRequest(value: unknown): value is BridgeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as BridgeRequest;
  if (
    Object.keys(r).some(
      (k) =>
        ![
          "version",
          "hostId",
          "memoryId",
          "language",
          "character",
          "requestId",
          "operation",
          "context",
          "choices",
          "fallbackChoiceId",
          "history",
        ].includes(k)
    )
  )
    return false;
  return (
    r.version === BRIDGE_VERSION &&
    id(r.hostId) &&
    (r.memoryId === undefined || id(r.memoryId)) &&
    (r.language === undefined || languageTag(r.language)) &&
    id(r.requestId) &&
    ["decide", "speak", "chat"].includes(r.operation) &&
    bounded(r.context, 1200) &&
    !!r.character &&
    Object.keys(r.character).every((k) =>
      ["id", "name", "temperament"].includes(k)
    ) &&
    id(r.character.id) &&
    bounded(r.character.name, 80) &&
    bounded(r.character.temperament, 160) &&
    Array.isArray(r.choices) &&
    r.choices.length <= 8 &&
    r.choices.every(
      (c) =>
        c &&
        Object.keys(c).every((k) => ["id", "label"].includes(k)) &&
        id(c.id) &&
        bounded(c.label, 160)
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
          [
            "id",
            "hostId",
            "summary",
            "kind",
            "actor",
            "observer",
            "recipient",
            "actorCharacterId",
            "actorCharacterName",
            "eventKind",
            "reportedClaims",
            "perspectiveCharacterId",
          ].includes(k)
        ) &&
        validAttribution(h) &&
        (h.eventKind === undefined ||
          ["progress", "outcome"].includes(h.eventKind)) &&
        id(h.id) &&
        id(h.hostId) &&
        bounded(h.summary, 300) &&
        ["observation", "user", "agent"].includes(h.kind)
    ) &&
    new TextEncoder().encode(JSON.stringify(r)).length <= 8000
  );
}
export function validBridgeResponse(
  value: unknown,
  request: BridgeRequest
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
/** Generic synthetic response. Domain-authored scenarios belong to the host composition. */
export function scenarioResponse(
  request: BridgeRequest,
  source: BridgeResponse["source"] = "scenario"
): BridgeResponse {
  return {
    choiceId: request.fallbackChoiceId,
    source,
    speech:
      request.language === "ru"
        ? "Я слушаю. Что ты хочешь обсудить?"
        : "I'm listening. What would you like to discuss?",
  };
}
export function createGameBridge(options: {
  /** Host request budget in milliseconds (1–60000); default 18000. */
  requestTimeoutMs?: number;
  hostId: string;
  memoryId?: string;
  language?: string;
  character: GameCharacter;
  transport: BridgeTransport;
  /** Optional host-authored fallback; validated and always labelled fallback. */
  fallback?: (request: BridgeRequest) => BridgeResponse;
  history: () => BridgeHistory[];
  onObservation: (event: BridgeHistory) => void;
  onSpeech: (response: BridgeResponse, request: BridgeRequest) => void;
  signal: AbortSignal;
}): GameBridge & {
  chat(message: string): Promise<BridgeResponse>;
  dispose(): void;
} {
  const requestTimeoutMs = options.requestTimeoutMs ?? 18000;
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    requestTimeoutMs > 60000
  )
    throw new RangeError("Invalid bridge request timeout");
  const actorCharacter = {
    id: options.character.id,
    name: options.character.name,
  };
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
    }
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
      ...(options.memoryId ? { memoryId: options.memoryId } : {}),
      ...(options.language ? { language: options.language } : {}),
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
          ...(h.eventKind !== undefined ? { eventKind: h.eventKind } : {}),
          ...(h.actor !== undefined ? { actor: h.actor } : {}),
          ...(h.actorCharacterId !== undefined
            ? { actorCharacterId: h.actorCharacterId }
            : {}),
          ...(h.actorCharacterName !== undefined
            ? { actorCharacterName: h.actorCharacterName }
            : {}),
          ...(h.observer !== undefined ? { observer: h.observer } : {}),
          ...(h.recipient !== undefined ? { recipient: h.recipient } : {}),
          ...(h.reportedClaims !== undefined
            ? { reportedClaims: structuredClone(h.reportedClaims) }
            : {}),
          ...(h.perspectiveCharacterId !== undefined
            ? { perspectiveCharacterId: h.perspectiveCharacterId }
            : {}),
        })),
    };
    if (!validBridgeRequest(input))
      throw Error("Unsupported or oversized bridge request");
    const deadline = AbortSignal.any([
      signal,
      AbortSignal.timeout(requestTimeoutMs),
    ]);
    let response: BridgeResponse;
    let abort: () => void = () => {};
    try {
      response = await Promise.race([
        options.transport(structuredClone(input), deadline),
        new Promise<never>((_, reject) => {
          abort = () =>
            reject(
              new DOMException("Bridge cancelled or timed out", "AbortError")
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
      try {
        const fallback = options.fallback?.(structuredClone(input));
        if (fallback && validBridgeResponse(fallback, input))
          response = { ...fallback, source: "fallback" };
      } catch {
        // A failed host-authored presentation cannot invent an action or suppress safe fallback.
      }
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
        !validAttribution(event) ||
        (event.kind !== undefined &&
          !["progress", "outcome"].includes(event.kind)) ||
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
        perspectiveCharacterId: actorCharacter.id,
        summary: event.summary.slice(0, 300),
        ...(event.kind !== undefined ? { eventKind: event.kind } : {}),
        ...(event.actor !== undefined ? { actor: event.actor } : {}),
        ...(event.actor === "agent"
          ? {
              actorCharacterId: actorCharacter.id,
              actorCharacterName: actorCharacter.name,
            }
          : {}),
        ...(event.observer !== undefined ? { observer: event.observer } : {}),
        ...(event.recipient !== undefined
          ? { recipient: event.recipient }
          : {}),
        ...(event.reportedClaims !== undefined
          ? { reportedClaims: structuredClone(event.reportedClaims) }
          : {}),
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
  fetcher: typeof fetch = fetch
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
