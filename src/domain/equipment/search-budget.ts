export class SearchLimitError extends Error {
  constructor() {
    super("Purchase search node limit reached");
    this.name = "SearchLimitError";
  }
}
export type SearchBudget = { readonly visitedNodes: number; visit(): void };

/** One meter is shared by candidate, loadout, and acquisition exploration. */
export function createSearchBudget(maxNodes: number): SearchBudget {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 0)
    throw new Error("Search limit must be a nonnegative safe integer");
  let visitedNodes = 0;
  return {
    get visitedNodes() {
      return visitedNodes;
    },
    visit() {
      if (visitedNodes >= maxNodes) throw new SearchLimitError();
      visitedNodes++;
    },
  };
}
