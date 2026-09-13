import type { TopGearRequest } from "@/domain/top-gear/model";
import { createGearLabStore } from "@/features/inventory/state/gear-lab-store";

/** Exercise actual commands while keeping standalone UI assertions on resulting intent. */
export function testGearLabActions(
  request: TopGearRequest,
  onChange: (draft: TopGearRequest) => void,
) {
  const store = createGearLabStore();
  store.setState({ draft: request });
  store.subscribe((state) => {
    if (state.draft) onChange(state.draft);
  });
  return store.getState().actions;
}
