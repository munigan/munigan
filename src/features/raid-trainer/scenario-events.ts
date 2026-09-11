import type { Attempt, WorldEvent } from "./scenario-model";

type EventDetails = Pick<
  WorldEvent,
  "kind" | "sourceId" | "mechanic" | "checkpointId"
> &
  Partial<
    Pick<
      WorldEvent,
      | "at"
      | "actorIds"
      | "position"
      | "amount"
      | "protectedActorIds"
      | "obligations"
    >
  >;

/** The retained event log is the sequence counter, including after checkpoint restore. */
export function emitEvent(attempt: Attempt, details: EventDetails): WorldEvent {
  const event: WorldEvent = {
    id: `event-${attempt.world.events.length + 1}`,
    at: attempt.world.elapsed,
    actorIds: [],
    position: null,
    amount: 0,
    protectedActorIds: [],
    obligations: [],
    ...details,
  };
  attempt.world.events.push(event);
  return event;
}
