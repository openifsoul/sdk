/** Buffered transport support boundary, not a model context or hardware claim. */
export const BUFFERED_JSON_MAX_BYTES = 64 * 1024 * 1024;
export const BRIDGE_POLICY_VERSION =
  "ifsoul-bridge-resource-policy/0.4.0" as const;
export interface BridgeLimits {
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxContextChars: number;
  maxHistoryEntries: number;
  sentHistoryEntries: number;
  maxHistorySummaryChars: number;
  sentHistorySummaryChars: number;
  maxSpeechChars: number;
  timeoutMs: number;
  maxSessionRequests: number;
  maxReports: number;
  maxReportChars: number;
}
export const DEFAULT_BRIDGE_LIMITS: Readonly<BridgeLimits> = Object.freeze({
  maxRequestBytes: 8000,
  maxResponseBytes: 8192,
  maxContextChars: 1200,
  maxHistoryEntries: 12,
  sentHistoryEntries: 8,
  maxHistorySummaryChars: 300,
  sentHistorySummaryChars: 240,
  maxSpeechChars: 600,
  timeoutMs: 18000,
  maxSessionRequests: 128,
  maxReports: 128,
  maxReportChars: 600,
});
export interface BridgeCapabilities {
  version: typeof BRIDGE_POLICY_VERSION;
  envelopeVersion: "ifsoul-bridge/0.4.0";
  transport: "buffered-json";
  limits: BridgeLimits;
  bufferedMaxBytes: number;
}
export interface BridgeBudgetReport {
  requested: BridgeLimits;
  effective: BridgeLimits;
  source: "defaults" | "host" | "server-capability";
  transport: "buffered-json";
  bufferedMaxBytes: number;
}
export class BridgeBudgetError extends Error {
  constructor(
    readonly code: "unsupported-policy" | "budget-exceeded" | "configuration",
    readonly layer: string,
    readonly field: string,
    message?: string
  ) {
    super(message ?? `${code}: ${layer}.${field}`);
  }
}
export function resolveBridgeLimits(
  requested: Partial<BridgeLimits> = {},
  capability?: BridgeCapabilities
): BridgeBudgetReport {
  if (!requested || typeof requested !== "object" || Array.isArray(requested))
    throw new BridgeBudgetError("configuration", "bridge", "object-required");
  const limits = { ...DEFAULT_BRIDGE_LIMITS, ...requested };
  for (const field of Object.keys(requested)) {
    if (!Object.hasOwn(DEFAULT_BRIDGE_LIMITS, field))
      throw new BridgeBudgetError("configuration", "bridge", field);
  }
  for (const [field, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new BridgeBudgetError("configuration", "bridge", field);
  }
  for (const field of [
    "maxRequestBytes",
    "maxResponseBytes",
    "maxContextChars",
    "maxHistorySummaryChars",
    "maxSpeechChars",
    "maxReportChars",
  ] as const) {
    if (limits[field] > BUFFERED_JSON_MAX_BYTES)
      throw new BridgeBudgetError("unsupported-policy", "buffered-json", field);
  }
  if (limits.timeoutMs > 2_147_483_647)
    throw new BridgeBudgetError("unsupported-policy", "timer", "timeoutMs");
  if (
    limits.sentHistoryEntries > limits.maxHistoryEntries ||
    limits.sentHistorySummaryChars > limits.maxHistorySummaryChars
  )
    throw new BridgeBudgetError("configuration", "bridge", "sentHistory");
  if (!capability)
    return {
      requested: limits,
      effective: { ...limits },
      source: Object.keys(requested).length ? "host" : "defaults",
      transport: "buffered-json",
      bufferedMaxBytes: BUFFERED_JSON_MAX_BYTES,
    };
  if (
    !(
      capability.version === BRIDGE_POLICY_VERSION &&
      capability.envelopeVersion === "ifsoul-bridge/0.4.0"
    ) ||
    capability.transport !== "buffered-json" ||
    !Number.isSafeInteger(capability.bufferedMaxBytes) ||
    capability.bufferedMaxBytes < 1 ||
    capability.bufferedMaxBytes > BUFFERED_JSON_MAX_BYTES
  )
    throw new BridgeBudgetError(
      "unsupported-policy",
      "server-capability",
      "version-or-transport"
    );
  const accepted = resolveBridgeLimits(capability.limits).effective;
  const effective = Object.fromEntries(
    Object.entries(limits).map(([key, value]) => [
      key,
      Math.min(value, accepted[key as keyof BridgeLimits]),
    ])
  ) as unknown as BridgeLimits;
  effective.maxRequestBytes = Math.min(
    effective.maxRequestBytes,
    capability.bufferedMaxBytes
  );
  effective.maxResponseBytes = Math.min(
    effective.maxResponseBytes,
    capability.bufferedMaxBytes
  );
  return {
    requested: limits,
    effective,
    source: "server-capability",
    transport: "buffered-json",
    bufferedMaxBytes: capability.bufferedMaxBytes,
  };
}
export function needsServerCapability(limits: BridgeLimits): boolean {
  return Object.entries(limits).some(
    ([key, value]) => value > DEFAULT_BRIDGE_LIMITS[key as keyof BridgeLimits]
  );
}
export function bridgeCapabilities(
  limits: Partial<BridgeLimits> = {}
): BridgeCapabilities {
  return {
    version: BRIDGE_POLICY_VERSION,
    envelopeVersion: "ifsoul-bridge/0.4.0",
    transport: "buffered-json",
    limits: resolveBridgeLimits(limits).effective,
    bufferedMaxBytes: BUFFERED_JSON_MAX_BYTES,
  };
}
