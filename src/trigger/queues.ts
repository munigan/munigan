import { queue } from "@trigger.dev/sdk";
export const simulationQueue = queue({
  name: "wotlk-simulation",
  concurrencyLimit: 2,
});
