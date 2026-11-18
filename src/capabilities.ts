export type ConversationChannel = "private" | "group" | "public";
export interface ChannelPermissions {
  channel: ConversationChannel;
  listen: boolean;
  react: boolean;
  speak: boolean;
}
export interface ChannelPolicy {
  channels: ChannelPermissions[];
  fallback: "silence" | "private";
}
export const conversationChannels: readonly ConversationChannel[] = [
  "private",
  "group",
  "public",
];
export function validChannelPermissions(
  value: unknown,
): value is ChannelPermissions[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    value.every(
      (row) =>
        object(row, "channel listen react speak") &&
        conversationChannels.includes(row.channel as ConversationChannel) &&
        typeof row.listen === "boolean" &&
        typeof row.react === "boolean" &&
        typeof row.speak === "boolean" &&
        (!row.react || row.listen),
    ) &&
    new Set(value.map((row) => row.channel)).size === value.length
  );
}
export function validChannelPolicy(value: unknown): value is ChannelPolicy {
  return (
    object(value, "channels fallback") &&
    validChannelPermissions(value.channels) &&
    (value.fallback === "silence" || value.fallback === "private")
  );
}
/** Discovery over an authenticated host connection. A manifest supplies no grants. */
export interface CapabilityParameter {
  name: string;
  type: "entity-ref" | "choice" | "quantity" | "boolean";
  required: boolean;
  choices?: string[];
  unit?: string;
  minimum?: number;
  maximum?: number;
}
export interface HostCapability {
  intentId: string;
  category: string;
  description: string;
  parameters: CapabilityParameter[];
  cancellable: boolean;
  support: "supported" | "partial" | "unsupported";
  readiness: "ready" | "unavailable";
  reason?: string;
}
export interface CapabilityManifest {
  revision: string;
  worldId: string;
  embodimentId: string;
  capabilities: HostCapability[];
  channels?: ChannelPermissions[];
}
export interface CapabilitySession {
  providerId: string;
  manifest: CapabilityManifest;
  policyRevision: number;
  allowedIntentIds: string[];
  channelPolicy?: ChannelPolicy;
  expiresAt: number;
}
export interface CapabilityRequest {
  id: string;
  providerId: string;
  manifestRevision: string;
  policyRevision: number;
  intentId: string;
  checkpoint: number;
  arguments: { name: string; value: string | number | boolean }[];
}
export interface CapabilityReport {
  id: string;
  reportId: string;
  providerId: string;
  intentId: string;
  status: "progress" | "succeeded" | "partial" | "cancelled" | "failed";
  steps: { stepId: string; summary: string; count?: number }[];
}
const id = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const qualified = (x: unknown): x is string =>
  id(x) && /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/.test(x);
function object(x: unknown, keys: string): x is Record<string, unknown> {
  return (
    !!x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Object.keys(x).every((key) => keys.split(" ").includes(key))
  );
}
const text = (x: unknown, max: number): x is string =>
  typeof x === "string" &&
  x.trim().length > 0 &&
  x.length <= max &&
  !/[\p{Cc}\p{Cf}]/u.test(x);
const unique = <T>(values: T[]) => values.length === new Set(values).size;
function parameter(x: unknown): x is CapabilityParameter {
  if (
    !object(x, "name type required choices unit minimum maximum") ||
    !id(x.name) ||
    typeof x.required !== "boolean"
  )
    return false;
  switch (x.type) {
    case "choice":
      return (
        Array.isArray(x.choices) &&
        x.choices.length >= 1 &&
        x.choices.length <= 32 &&
        x.choices.every(id) &&
        unique(x.choices) &&
        x.unit === undefined &&
        x.minimum === undefined &&
        x.maximum === undefined
      );
    case "quantity":
      return (
        x.choices === undefined &&
        id(x.unit) &&
        typeof x.minimum === "number" &&
        Number.isFinite(x.minimum) &&
        typeof x.maximum === "number" &&
        Number.isFinite(x.maximum) &&
        x.maximum >= x.minimum
      );
    case "entity-ref":
    case "boolean":
      return (
        x.choices === undefined &&
        x.unit === undefined &&
        x.minimum === undefined &&
        x.maximum === undefined
      );
    default:
      return false;
  }
}
function capability(x: unknown): x is HostCapability {
  if (
    !object(
      x,
      "intentId category description parameters cancellable support readiness reason",
    )
  )
    return false;
  return (
    qualified(x.intentId) &&
    qualified(x.category) &&
    text(x.description, 160) &&
    typeof x.cancellable === "boolean" &&
    Array.isArray(x.parameters) &&
    x.parameters.length <= 8 &&
    x.parameters.every(parameter) &&
    unique(x.parameters.map((param) => param.name)) &&
    (x.support === "supported" ||
      x.support === "partial" ||
      x.support === "unsupported") &&
    (x.readiness === "ready" || x.readiness === "unavailable") &&
    (x.support !== "unsupported" || x.readiness === "unavailable") &&
    ((x.reason === undefined &&
      x.support === "supported" &&
      x.readiness === "ready") ||
      text(x.reason, 200))
  );
}
export function validCapabilityManifest(x: unknown): x is CapabilityManifest {
  return (
    object(x, "revision worldId embodimentId capabilities channels") &&
    (x.channels === undefined || validChannelPermissions(x.channels)) &&
    typeof x.revision === "string" &&
    /^[1-9][0-9]{0,14}$/.test(x.revision) &&
    id(x.worldId) &&
    id(x.embodimentId) &&
    Array.isArray(x.capabilities) &&
    x.capabilities.length <= 48 &&
    x.capabilities.every(capability) &&
    unique(x.capabilities.map((row) => row.intentId))
  );
}
export function validCapabilityRequest(x: unknown): x is CapabilityRequest {
  return (
    object(
      x,
      "id providerId manifestRevision policyRevision intentId checkpoint arguments",
    ) &&
    id(x.id) &&
    id(x.providerId) &&
    id(x.manifestRevision) &&
    Number.isSafeInteger(x.policyRevision) &&
    Number(x.policyRevision) >= 0 &&
    qualified(x.intentId) &&
    Number.isSafeInteger(x.checkpoint) &&
    Number(x.checkpoint) > 0 &&
    Array.isArray(x.arguments) &&
    x.arguments.length <= 8 &&
    x.arguments.every(
      (arg) =>
        object(arg, "name value") &&
        id(arg.name) &&
        (id(arg.value) ||
          typeof arg.value === "boolean" ||
          (typeof arg.value === "number" && Number.isFinite(arg.value))),
    ) &&
    unique(x.arguments.map((arg) => arg.name))
  );
}
export function capabilityAccepts(
  capability: HostCapability,
  request: CapabilityRequest,
): boolean {
  return (
    capability.intentId === request.intentId &&
    capability.support !== "unsupported" &&
    capability.readiness === "ready" &&
    request.arguments.every((arg) =>
      capability.parameters.some((param) => param.name === arg.name),
    ) &&
    capability.parameters.every((param) => {
      const argument = request.arguments.find((arg) => arg.name === param.name);
      if (!argument) return !param.required;
      const { value } = argument;
      switch (param.type) {
        case "choice":
          return typeof value === "string" && !!param.choices?.includes(value);
        case "quantity":
          return (
            typeof value === "number" &&
            value >= (param.minimum ?? -Infinity) &&
            value <= (param.maximum ?? Infinity)
          );
        case "entity-ref":
          return id(value);
        case "boolean":
          return typeof value === "boolean";
      }
    })
  );
}
export function validCapabilityReport(x: unknown): x is CapabilityReport {
  return (
    object(x, "id reportId providerId intentId status steps") &&
    id(x.id) &&
    id(x.reportId) &&
    id(x.providerId) &&
    qualified(x.intentId) &&
    (x.status === "progress" ||
      x.status === "succeeded" ||
      x.status === "partial" ||
      x.status === "cancelled" ||
      x.status === "failed") &&
    Array.isArray(x.steps) &&
    x.steps.length <= 8 &&
    ((x.status !== "succeeded" && x.status !== "partial") ||
      x.steps.length > 0) &&
    x.steps.every(
      (step) =>
        object(step, "stepId summary count") &&
        id(step.stepId) &&
        text(step.summary, 140) &&
        (step.count === undefined ||
          (Number.isSafeInteger(step.count) && Number(step.count) >= 0)),
    ) &&
    unique(x.steps.map((step) => step.stepId))
  );
}
