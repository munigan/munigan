import { expect, it } from "vitest";
import { createSearchBudget, SearchLimitError } from "./search-budget";
it("meters visits and throws without exceeding the shared maximum", () => {
  const budget = createSearchBudget(2);
  budget.visit();
  budget.visit();
  expect(budget.visitedNodes).toBe(2);
  expect(() => budget.visit()).toThrow(SearchLimitError);
  expect(budget.visitedNodes).toBe(2);
  expect(() => createSearchBudget(0).visit()).toThrow(SearchLimitError);
});
it("rejects invalid limits", () => {
  for (const limit of [-1, 1.5, Infinity, NaN])
    expect(() => createSearchBudget(limit)).toThrow();
});
