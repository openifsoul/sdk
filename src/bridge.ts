import {
  resolveBridgeLimits,
  BridgeBudgetError,
  needsServerCapability,
} from "./resource-policy.js";
import type {
  BridgeLimits,
  BridgeCapabilities,
  BridgeBudgetReport,
} from "./resource-policy.js";
export * from "./resource-policy.js";
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
export class BridgeRequestError extends Error {
  readonly code: "request-rejected" | "unsupported-version" =
    "request-rejected";
  constructor() {
    super(
      "The server rejected this bridge request. Check its supported IfSoul version and request shape; no downgrade or retry was attempted.",
    );
  }
}
export class BridgeVersionError extends BridgeRequestError {
  override readonly code = "unsupported-version" as const;
}
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
            ["subject", "key", "value"].includes(key),
          ) &&
          ["actor", "recipient"].includes(claim.subject) &&
          ["role", "preference"].includes(claim.key) &&
          bounded(claim.value, 160),
      ))) &&
  (value.actorCharacterId === undefined || id(value.actorCharacterId)) &&
  (value.actorCharacterName === undefined ||
    bounded(value.actorCharacterName, 80)) &&
  [value.actor, value.observer, value.recipient].every(
    (role) =>
      role === undefined ||
      ["user", "agent", "host", "unknown"].includes(role as string),
  );
export function validBridgeRequest(
  value: unknown,
  policy?: Partial<BridgeLimits>,
): value is BridgeRequest {
  const limits = resolveBridgeLimits(policy).effective;
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
        ].includes(k),
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
    bounded(r.context, limits.maxContextChars) &&
    !!r.character &&
    Object.keys(r.character).every((k) =>
      ["id", "name", "temperament"].includes(k),
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
        bounded(c.label, 160),
    ) &&
    new Set(r.choices.map((c) => c.id)).size === r.choices.length &&
    (r.operation === "decide"
      ? r.choices.length > 0 &&
        r.choices.some((c) => c.id === r.fallbackChoiceId)
      : r.choices.length === 0 && r.fallbackChoiceId === "") &&
    Array.isArray(r.history) &&
    r.history.length <= limits.maxHistoryEntries &&
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
          ].includes(k),
        ) &&
        validAttribution(h) &&
        (h.eventKind === undefined ||
          ["progress", "outcome"].includes(h.eventKind)) &&
        id(h.id) &&
        id(h.hostId) &&
        bounded(h.summary, limits.maxHistorySummaryChars) &&
        ["observation", "user", "agent"].includes(h.kind),
    ) &&
    new TextEncoder().encode(JSON.stringify(r)).length <= limits.maxRequestBytes
  );
}
export function validBridgeResponse(
  value: unknown,
  request: BridgeRequest,
  policy?: Partial<BridgeLimits>,
): value is BridgeResponse {
  const limits = resolveBridgeLimits(policy).effective;
  if (!value || typeof value !== "object") return false;
  const r = value as BridgeResponse;
  return (
    Object.keys(r).every((k) => ["choiceId", "speech", "source"].includes(k)) &&
    typeof r.speech === "string" &&
    r.speech.length <= limits.maxSpeechChars &&
    ["scenario", "llm", "fallback"].includes(r.source) &&
    (request.operation === "decide"
      ? request.choices.some((c) => c.id === r.choiceId)
      : r.choiceId === "")
  );
}
/** Generic synthetic response. Domain-authored scenarios belong to the host composition. */
export function scenarioResponse(
  request: BridgeRequest,
  source: BridgeResponse["source"] = "scenario",
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
  /** Trusted host configuration, never copied from a model or browser request. */
  limits?: Partial<BridgeLimits>;
  onBudgetError?: (error: BridgeBudgetError) => void;
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
  if (
    options.limits === undefined &&
    options.requestTimeoutMs !== undefined &&
    (!Number.isInteger(options.requestTimeoutMs) ||
      options.requestTimeoutMs < 1 ||
      options.requestTimeoutMs > 60000)
  )
    throw new RangeError("Invalid bridge request timeout");
  if (
    options.requestTimeoutMs !== undefined &&
    options.limits?.timeoutMs !== undefined &&
    options.requestTimeoutMs !== options.limits.timeoutMs
  )
    throw new BridgeBudgetError(
      "configuration",
      "bridge",
      "conflicting-timeout",
    );
  const limits = resolveBridgeLimits({
    ...options.limits,
    ...(options.requestTimeoutMs === undefined
      ? {}
      : { timeoutMs: options.requestTimeoutMs }),
  }).effective;
  const requestTimeoutMs = limits.timeoutMs;
  if (
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    (options.limits === undefined && requestTimeoutMs > 60000)
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
    },
  ) {
    if (signal.aborted)
      throw new DOMException("Bridge disconnected", "AbortError");
    if (!id(request.requestId)) throw Error("Invalid host request identifier");
    if (!requestIds.has(request.requestId)) {
      if (requestIds.size >= limits.maxSessionRequests)
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
        .slice(-limits.sentHistoryEntries)
        .map((h) => ({
          id: h.id,
          hostId: h.hostId,
          kind: h.kind,
          summary: h.summary.slice(0, limits.sentHistorySummaryChars),
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
    if (!validBridgeRequest(input, limits))
      throw new BridgeBudgetError(
        "budget-exceeded",
        "bridge-request",
        "configured-envelope",
        "Unsupported or oversized bridge request",
      );
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
              new DOMException("Bridge cancelled or timed out", "AbortError"),
            );
          deadline.addEventListener("abort", abort, { once: true });
          if (deadline.aborted) abort();
        }),
      ]);
      if (!validBridgeResponse(response, input, limits))
        throw Error("Invalid agent proposal");
    } catch (error) {
      if (error instanceof BridgeBudgetError) {
        try {
          options.onBudgetError?.(error);
        } catch {}
      }
      if (signal.aborted || error instanceof BridgeRequestError) throw error;
      response = scenarioResponse(input, "fallback");
      try {
        const fallback = options.fallback?.(structuredClone(input));
        if (fallback && validBridgeResponse(fallback, input, limits))
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
        !bounded(event.summary, limits.maxReportChars) ||
        seen.has(event.id) ||
        seen.size >= limits.maxReports
      )
        return;
      seen.add(event.id);
      options.onObservation({
        id: event.id,
        hostId: options.hostId,
        kind: "observation",
        perspectiveCharacterId: actorCharacter.id,
        summary: event.summary.slice(0, limits.maxHistorySummaryChars),
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
async function boundedReply(
  response: Response,
  maximum: number,
  signal: AbortSignal,
): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (length > maximum) {
    void response.body?.cancel().catch(() => {});
    throw new BridgeBudgetError(
      "budget-exceeded",
      "http-response",
      "maxResponseBytes",
      "Oversized bridge reply",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("Missing bridge reply");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let rejectAbort: (reason: unknown) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const abort = () =>
    rejectAbort(
      new DOMException("Bridge cancelled or timed out", "AbortError"),
    );
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    for (;;) {
      if (signal.aborted)
        throw new DOMException("Bridge cancelled or timed out", "AbortError");
      const part = await Promise.race([reader.read(), cancelled]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum)
        throw new BridgeBudgetError(
          "budget-exceeded",
          "http-response",
          "maxResponseBytes",
          "Oversized bridge reply",
        );
      chunks.push(part.value);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (signal.aborted)
    throw new DOMException("Bridge cancelled or timed out", "AbortError");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function createHTTPTransport(
  endpoint: string,
  fetcher: typeof fetch = fetch,
  options: {
    limits?: Partial<BridgeLimits>;
    capabilityEndpoint?: string;
    serverCapability?: BridgeCapabilities;
    onBudget?: (report: BridgeBudgetReport) => void;
  } = {},
): BridgeTransport {
  const requested = resolveBridgeLimits(options.limits).effective;
  let capability: BridgeCapabilities | undefined;
  const effectivePolicy = async (signal: AbortSignal) => {
    if (!needsServerCapability(requested))
      return resolveBridgeLimits(options.limits);
    const discovered =
      capability ??
      (await (async () => {
        if (options.serverCapability) return options.serverCapability;
        const endpointURL = new URL(endpoint, "http://ifsoul-relative.invalid");
        const capabilityURL = new URL(
          options.capabilityEndpoint ?? "/api/resource-policy",
          endpointURL,
        );
        if (capabilityURL.origin !== endpointURL.origin)
          throw new BridgeBudgetError(
            "unsupported-policy",
            "server-capability",
            "origin",
          );
        const target =
          endpointURL.origin === "http://ifsoul-relative.invalid"
            ? capabilityURL.pathname + capabilityURL.search
            : capabilityURL.href;
        const response = await fetcher(target, {
          method: "GET",
          credentials: "same-origin",
          signal,
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw new BridgeBudgetError(
            "unsupported-policy",
            "server-capability",
            "unavailable",
          );
        }
        const metadata = (await boundedReply(response, 16384, signal)) as {
          bridge?: BridgeCapabilities;
        };
        if (!metadata || typeof metadata !== "object" || !metadata.bridge)
          throw new BridgeBudgetError(
            "unsupported-policy",
            "server-capability",
            "missing",
          );
        return metadata.bridge;
      })());
    const report = resolveBridgeLimits(options.limits, discovered);
    capability = discovered;
    return report;
  };
  return async (request, parentSignal) => {
    if (parentSignal.aborted)
      throw new DOMException("Bridge cancelled or timed out", "AbortError");
    const started = performance.now();
    let signal = options.limits
      ? AbortSignal.any([
          parentSignal,
          AbortSignal.timeout(requested.timeoutMs),
        ])
      : parentSignal;
    const report = await effectivePolicy(signal);
    if (options.limits)
      signal = AbortSignal.any([
        signal,
        AbortSignal.timeout(
          Math.max(
            1,
            Math.ceil(
              report.effective.timeoutMs - (performance.now() - started),
            ),
          ),
        ),
      ]);
    try {
      options.onBudget?.(structuredClone(report));
    } catch {
      /* Diagnostics cannot authorize requests. */
    }
    if (!validBridgeRequest(request, report.effective))
      throw new BridgeBudgetError(
        "budget-exceeded",
        "bridge-request",
        "configured-envelope",
      );
    const response = await fetcher(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      if (
        [400, 401, 403, 409].includes(response.status) &&
        request.version === BRIDGE_VERSION
      ) {
        let body: { error?: { code?: string } };
        try {
          body = (await boundedReply(
            response,
            report.effective.maxResponseBytes,
            signal,
          )) as typeof body;
        } catch {
          throw new BridgeRequestError();
        }
        if (body?.error?.code === "unsupported-version")
          throw new BridgeVersionError();
        throw new BridgeRequestError();
      }
      void response.body?.cancel().catch(() => {});
      throw Error("Bridge request unavailable");
    }
    const result = await boundedReply(
      response,
      report.effective.maxResponseBytes,
      signal,
    );
    if (!validBridgeResponse(result, request, report.effective))
      throw Error("Invalid bridge reply");
    return result;
  };
}
