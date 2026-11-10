/** Typed high-level planning boundary; transport authentication stays in the host composition. */
export interface SchedulerHostPort<Config, Trigger, Claim, Report, Inspection, RunResult> {
  configure(request: { expectedRevision: number; config: Config }): Promise<Config>;
  control(request: { scheduleId: string; expectedRevision: number; action: "pause" | "resume" | "cancel" }): Promise<Config>;
  runDue(): Promise<RunResult[]>;
  trigger(request: { scheduleId: string; trigger: Trigger }): Promise<RunResult>;
  report(report: Report): Promise<Claim>;
  reconcile(request: { claimId: string }): Promise<Claim>;
  inspect(request: { scheduleId: string }): Promise<Inspection>;
}
/** No retries, fallback actions, clock advancement or speech are synthesized by this client. */
export function createSchedulerClient<C,T,A,H,I,R>(port: SchedulerHostPort<C,T,A,H,I,R>): SchedulerHostPort<C,T,A,H,I,R> {
  return {
    configure: request => port.configure(structuredClone(request)),
    control: request => port.control(structuredClone(request)),
    runDue: () => port.runDue(),
    trigger: request => port.trigger(structuredClone(request)),
    report: report => port.report(structuredClone(report)),
    reconcile: request => port.reconcile(structuredClone(request)),
    inspect: request => port.inspect(structuredClone(request)),
  };
}
