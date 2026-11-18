import type { CapabilityRequest, ConversationChannel } from "./capabilities.js";

/** A trusted native route identifies the player and assigns group roles. */
export interface AdventureUtterance {
  eventId: string;
  playerUuid: string;
  audience: "group" | "public" | "private";
  addressedTo?: string;
  text: string;
}
export interface AdventureAssignment extends Omit<
  CapabilityRequest,
  "checkpoint"
> {
  /** Bound native actor name in this group credential. */
  name: string;
}
export interface AdventureReply {
  name: string;
  speech: string;
  recipient?: string;
  destination?: ConversationChannel;
}
export interface AdventureResponse {
  replies: AdventureReply[];
  assignments: AdventureAssignment[];
  cancelled?: true;
}
