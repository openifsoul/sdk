/** One versioned server-owned configuration is shared by SDK and App. */
export interface BehaviorHostPort<Snapshot, Configuration, Inspection> {
  read(): Promise<Snapshot>;
  update(request: {
    expectedRevision: number;
    config: Configuration;
  }): Promise<Snapshot>;
  inspect(request: { sessionId: string; npcId: string }): Promise<Inspection>;
}
/** Trusted transport owns authentication; no operator constraints or model writes are synthesized. */
export function createBehaviorClient<S, C, I>(
  port: BehaviorHostPort<S, C, I>,
): BehaviorHostPort<S, C, I> {
  return {
    read: () => port.read(),
    update: (request) => port.update(structuredClone(request)),
    inspect: (request) => port.inspect(structuredClone(request)),
  };
}
