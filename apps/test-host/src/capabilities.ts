import type { CapabilityManifest } from "../../../src/bridge.js";

/** A synthetic museum station. The host owns the lamps and their concrete positions. */
export const stationManifest: CapabilityManifest = {
  revision: "1",
  worldId: "museum",
  embodimentId: "station-3",
  capabilities: [
    {
      intentId: "museum.adjust-lamp",
      category: "museum.lighting",
      description: "Adjust a display lamp",
      cancellable: false,
      support: "supported",
      readiness: "ready",
      parameters: [
        {
          name: "lamp",
          type: "choice",
          choices: ["north", "south"],
          required: true,
        },
        {
          name: "level",
          type: "quantity",
          unit: "percent",
          minimum: 0,
          maximum: 60,
          required: true,
        },
      ],
    },
  ],
};
