/** Typed session host port. The trusted service supplies its Core domain types.
 * Authentication belongs to the transport closure, never participant display names.
 * Host adoption/execution remains separate from dialogue generation. */
export interface SessionHostPort<Session, Event, Turn, Projection> {
  transition(request: { transitionId: string; expectedRevision: number; session: Session }): Promise<Session>;
  append(event: Event): Promise<Event>;
  history(request: { sessionId: string; participantId: string }): Promise<Event[]>;
  converse(request: Turn): Promise<Projection>;
}
/** A transport adapter preserves the service's exact parameter/result types. No default authority or fallback. */
export function createSessionClient<S, E, T, P>(port: SessionHostPort<S, E, T, P>): SessionHostPort<S, E, T, P> {
  return {
    transition: request => port.transition(structuredClone(request)),
    append: event => port.append(structuredClone(event)),
    history: request => port.history(structuredClone(request)),
    converse: request => port.converse(structuredClone(request)),
  };
}
