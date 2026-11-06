import {
  createGameBridge,
  createHTTPTransport,
  scenarioResponse,
} from "../../../src/index.js";
import type { BridgeHistory, BridgeTransport } from "../../../src/index.js";

/** Separate process example: the host executes mechanics, never the model. */
async function main() {
  const server = process.env.IFSOUL_DEMO_SERVER;
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
    const token = process.env.IFSOUL_DEMO_TOKEN;
    if (url.protocol === "https:" && !token)
      throw Error(
        "Set IFSOUL_DEMO_TOKEN to a current Clerk session token for cloud mode.",
      );
    transport = createHTTPTransport(
      new URL("/api/demo/bridge", url).href,
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
    );
  }
  const controller = new AbortController(),
    history: BridgeHistory[] = [];
  const bridge = createGameBridge({
    hostId: "test-host",
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
        context: `The test host has ${water} water and one ${watered ? "watered" : "dry"} bed.`,
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
main().catch(() => {
  console.error(
    "Test host failed. Check server, sign-in, and host prerequisites; credentials are never printed.",
  );
  process.exitCode = 1;
});
