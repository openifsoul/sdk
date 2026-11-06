/** Experimental browser-host port. Decisions never execute host mechanics. */
export interface GameCharacter {
  id: string;
  name: string;
  temperament: "careful" | "bold" | "curious";
}
export interface HostObservation {
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
export interface GameMountOptions {
  bridge: GameBridge;
  character: GameCharacter;
  signal: AbortSignal;
}
export interface MountedGame {
  /** Optional presentation of player-requested chat. Never executes host actions. */
  say?(speech: string): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
export type MountGame = (
  container: HTMLElement,
  options: GameMountOptions,
) => Promise<MountedGame>;
