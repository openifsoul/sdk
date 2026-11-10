import type { GameCharacter } from "./host-port.js";
export const IFSOUL_VERSION = "0.5.0" as const;
export const BRIDGE_VERSION = "ifsoul-bridge/0.4.0" as const;
export type BridgeVersion = typeof BRIDGE_VERSION;
/** Participant roles are claims from the reporting host, not verified identity. */
export type EventParticipant = "user" | "agent" | "host" | "unknown";
/** Host-reported participant claim, never independently verified world truth. */
export interface ReportedClaim {
  subject: "actor" | "recipient";
  key: "role" | "preference";
  value: string;
}
export interface EventAttribution {
  reportedClaims?: ReportedClaim[];
  /** Agent perspective captured when the report is received, not when later uploaded. */
  perspectiveCharacterId?: string;
  actor?: EventParticipant;
  /** Historical agent profile claimed at event time; never inferred from a later profile. */
  actorCharacterId?: string;
  actorCharacterName?: string;
  observer?: EventParticipant;
  recipient?: EventParticipant;
}
export interface BridgeHistory extends EventAttribution {
  eventKind?: "progress" | "outcome";
  id: string;
  hostId: string;
  summary: string;
  kind: "observation" | "user" | "agent";
}
/** Experimental application transport; not a replacement for normative v0.2 documents. */
export interface BridgeRequest {
  version: BridgeVersion;
  hostId: string;
  /** Account-scoped continuity identity, independent of the character profile. */
  memoryId?: string;
  language?: string;
  character: GameCharacter;
  requestId: string;
  operation: "decide" | "speak" | "chat";
  context: string;
  choices: { id: string; label: string }[];
  fallbackChoiceId: string;
  history: BridgeHistory[];
}
export interface BridgeResponse {
  choiceId: string;
  speech: string;
  source: "scenario" | "llm" | "fallback";
}
export type BridgeTransport = (
  request: BridgeRequest,
  signal: AbortSignal
) => Promise<BridgeResponse>;
