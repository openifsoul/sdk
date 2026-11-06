import type { GameCharacter } from "./game-host.js";
export const BRIDGE_VERSION = "ifsoul-bridge/0.1" as const;
export interface BridgeHistory {
  id: string;
  hostId: string;
  summary: string;
  kind: "observation" | "user" | "agent";
}
/** Experimental application transport; not a replacement for normative v0.2 documents. */
export interface BridgeRequest {
  version: typeof BRIDGE_VERSION;
  hostId: string;
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
  signal: AbortSignal,
) => Promise<BridgeResponse>;
