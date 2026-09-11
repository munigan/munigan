import type { Attempt } from "./scenario-model";

/** Consume only at observable choices; checkpointed state owns the sequence. */
export function nextRandom(attempt: Attempt): number {
  let state = attempt.rngState | 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  attempt.rngState = state >>> 0;
  return attempt.rngState / 4294967296;
}
