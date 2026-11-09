import { readFileSync } from "node:fs";
import {
  createGameBridge,
  createHTTPTransport,
  scenarioResponse,
  resolveBridgeLimits,
} from "../../../src/bridge.js";
import type {
  BridgeHistory,
  BridgeTransport,
  BridgeLimits,
} from "../../../src/bridge.js";

class DemoConfigurationError extends Error {}

/** Separate process example: the host executes mechanics, never the model. */
async function main() {
  const server = process.env.IFSOUL_DEMO_SERVER;
  let configuredLimits: Partial<BridgeLimits> | undefined;
  if (
    process.env.IFSOUL_BRIDGE_RESOURCE_POLICY &&
    process.env.IFSOUL_BRIDGE_RESOURCE_POLICY_FILE
  )
    throw new DemoConfigurationError(
      "Select one bridge resource policy source."
    );
  const policyText =
    process.env.IFSOUL_BRIDGE_RESOURCE_POLICY ??
    (process.env.IFSOUL_BRIDGE_RESOURCE_POLICY_FILE
      ? readFileSync(process.env.IFSOUL_BRIDGE_RESOURCE_POLICY_FILE, "utf8")
      : undefined);
  if (policyText !== undefined) {
    try {
      configuredLimits = JSON.parse(policyText) as Partial<BridgeLimits>;
      resolveBridgeLimits(configuredLimits);
    } catch {
      throw new DemoConfigurationError(
        "The bridge resource policy must be a supported bounded JSON object."
      );
    }
  }
  let requestTimeoutMs: number | undefined;
  let transport: BridgeTransport = async (request) => scenarioResponse(request);
  if (server) {
    const url = new URL(server);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      )
    )
      throw Error("Use HTTPS or a local loopback demo server.");
    const provider = process.env.IFSOUL_DEMO_PROVIDER;
    const model = process.env.IFSOUL_DEMO_MODEL;
    if (
      !provider ||
      !["ollama", "openai", "cloudflare"].includes(provider) ||
      !model ||
      !/^[A-Za-z0-9@][A-Za-z0-9@._:/-]{0,127}$/.test(model)
    )
      throw new DemoConfigurationError(
        "Server mode requires IFSOUL_DEMO_PROVIDER=ollama|openai|cloudflare and IFSOUL_DEMO_MODEL set to an available model. Configure the provider in App Settings first."
      );
    requestTimeoutMs = provider === "ollama" ? 60000 : undefined;
    const token = process.env.IFSOUL_DEMO_TOKEN;
    const endpoint = new URL("/api/bridge", url);
    endpoint.searchParams.set("provider", provider);
    endpoint.searchParams.set("model", model);
    const transportLimits = configuredLimits
      ? {
          ...configuredLimits,
          timeoutMs: configuredLimits.timeoutMs ?? requestTimeoutMs ?? 18000,
        }
      : undefined;
    transport = createHTTPTransport(
      endpoint.href,
      (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          headers: {
            ...Object.fromEntries(new Headers(init?.headers)),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            origin: url.origin,
          },
        }),
      {
        limits: transportLimits,
        ...(process.env.IFSOUL_DEMO_SHOW_BUDGET === "1"
          ? {
              onBudget: (report) =>
                console.log(
                  JSON.stringify({ event: "resource-policy", ...report })
                ),
            }
          : {}),
      }
    );
  }
  const controller = new AbortController(),
    history: BridgeHistory[] = [];
  const bridge = createGameBridge({
    hostId: "test-host",
    requestTimeoutMs: configuredLimits?.timeoutMs ?? requestTimeoutMs,
    limits: configuredLimits,
    character: { id: "mira", name: "Mira", temperament: "careful" },
    signal: controller.signal,
    transport,
    history: () => history,
    onObservation: (event) => {
      history.push(event);
      console.log(`Host: ${event.summary}`);
    },
    onSpeech: (reply) =>
      console.log(`Companion (${reply.source}): ${reply.speech}`),
  });
  try {
    let water = 0;
    let watered = false;
    for (let turn = 0; turn < 2; turn++) {
      const choices =
        water === 0
          ? [{ id: "fetch-water", label: "Fill the watering can at the well" }]
          : [{ id: "water-bed", label: "Water the one dry bed" }];
      const decision = await bridge.decide({
        requestId: `turn-${turn}-${crypto.randomUUID()}`,
        context: `The test host has ${water} water and one ${
          watered ? "watered" : "dry"
        } bed.`,
        choices,
        fallbackChoiceId: choices[0].id,
      });
      // Host checks current preconditions and performs its own state change.
      if (decision.choiceId === "fetch-water" && water === 0) {
        water = 1;
        bridge.report({
          id: "water-collected",
          summary: "The host filled one watering can at its well.",
        });
      } else if (decision.choiceId === "water-bed" && water === 1) {
        water = 0;
        watered = true;
        bridge.report({
          id: "bed-watered",
          summary: "The host used the watering can and watered its dry bed.",
          kind: "outcome",
        });
      } else throw Error("Host rejected a stale or unsupported proposal.");
    }
    await bridge.chat("What happened in the test garden?");
    if (!watered) throw Error("Test host did not finish.");
  } finally {
    controller.abort();
    bridge.dispose();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof DemoConfigurationError
      ? error.message
      : "Test host failed. Check endpoint, authentication, and host prerequisites; credentials are never printed."
  );
  process.exitCode = 1;
});
