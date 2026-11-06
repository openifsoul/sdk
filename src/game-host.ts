import type { GameBridge, GameCharacter } from "./host-port.js";
export type * from "./host-port.js";
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
  options: GameMountOptions
) => Promise<MountedGame>;
