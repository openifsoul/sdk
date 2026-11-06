import type { EventAttribution } from "./port.js";
/** Experimental bounded host port. Decisions never execute host mechanics. */
export interface GameCharacter {
  id: string;
  name: string;
  temperament: string;
}
export interface HostObservation extends EventAttribution {
  id: string;
  summary: string;
  kind?: "progress" | "outcome";
}
export interface DecisionRequest {
  requestId: string;
  context: string;
  choices: { id: string; label: string }[];
  fallbackChoiceId: string;
}
export interface AgentDecision {
  choiceId: string;
  speech: string;
  source: "scenario" | "llm" | "fallback";
}
export interface GameBridge {
  decide(request: DecisionRequest): Promise<AgentDecision>;
  speak(request: {
    requestId: string;
    context: string;
  }): Promise<{ speech: string; source: AgentDecision["source"] }>;
  report(observation: HostObservation): void;
}
