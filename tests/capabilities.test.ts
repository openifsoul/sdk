import assert from "node:assert/strict";
import { test } from "node:test";
import {
  capabilityAccepts,
  validCapabilityManifest,
  validCapabilityRequest,
} from "../src/bridge.js";
import { stationManifest } from "../apps/test-host/src/capabilities.js";

test("test host advertises namespaced museum actions and accepts only bounded parameters", () => {
  const action = stationManifest.capabilities[0]!;
  const request = {
    id: "adjust-1",
    providerId: "station-lease",
    manifestRevision: "1",
    policyRevision: 1,
    checkpoint: 1,
    intentId: action.intentId,
    arguments: [
      { name: "lamp", value: "north" },
      { name: "level", value: 60 },
    ],
  };
  assert(validCapabilityManifest(stationManifest));
  assert(!validCapabilityManifest({ ...stationManifest, revision: "r1" }));
  assert(
    !validCapabilityManifest({
      ...stationManifest,
      capabilities: [action, action],
    }),
  );
  assert(
    !validCapabilityManifest({
      ...stationManifest,
      capabilities: [{ ...action, readiness: "unavailable" }],
    }),
  );
  assert(validCapabilityRequest(request));
  assert(!validCapabilityRequest({ ...request, checkpoint: 0 }));
  assert(!validCapabilityRequest({ ...request, grant: true }));
  assert(
    !validCapabilityRequest({
      ...request,
      arguments: [...request.arguments, request.arguments[0]],
    }),
  );
  assert(capabilityAccepts(action, request));
  assert(
    !capabilityAccepts(action, {
      ...request,
      arguments: [{ name: "lamp", value: "north" }],
    }),
  );
  assert(
    !capabilityAccepts(action, {
      ...request,
      arguments: [
        { name: "lamp", value: "north" },
        { name: "level", value: 61 },
      ],
    }),
  );
});
