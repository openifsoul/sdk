# @ifsoul/adapter-sdk

Bounded character dialogue and decision bridges for browser and Node.js hosts.
IfSoul 0.4.0 includes ESM JavaScript and TypeScript declarations. Use Node.js
22.18 or newer for Node hosts; no game engine, account, provider or Core checkout
is required for the deterministic scenario transport.

## Install

```sh
npm install @ifsoul/adapter-sdk@0.4.0
```

```ts
import { createGameBridge, scenarioResponse } from "@ifsoul/adapter-sdk";
import type { GameMountOptions, MountedGame } from "@ifsoul/adapter-sdk";
```

The package root exposes `createGameBridge`, `createHTTPTransport`,
`scenarioResponse`, request/response validators and the bridge/game host types.
`@ifsoul/adapter-sdk/package.json` exposes version metadata. Internal source files
are not supported package subpaths. The archive contains compiled distribution
files, this README, the manifest and Apache-2.0 license; no provider implementation,
server, application configuration or credential is included.

## The bounded bridge

An application supplies a transport, bounded history callbacks, a character and
an AbortSignal. The SDK binds decide/speak/chat requests to that character,
validates replies and reports their `scenario`, `llm` or `fallback` source.
Temperament is a bounded nonempty string (160 characters), supplied by the host.
The three first-party voices are example content, not a generic character model.
An optional language is a locale tag accepted by `Intl.getCanonicalLocales`,
bounded to 64 characters (for example `fr` or `ja-JP`). A tag requests language;
it does not prove provider support. Generic synthetic speech currently has English
and Russian copy; other tags receive neutral English speech.

The application envelope is `ifsoul-bridge/0.4.0`. It is not an archive format or
full EnvironmentBridge handshake. Public declarations describe its current shape;
see [compatibility](docs/compatibility.md) for supported versions.

- A decision advertises at most eight unique host-owned choices and one allowed
  fallback. A response cannot introduce another choice. Speak/chat have no action
  choices. The caller must check current legality and freshness before adoption.
- By default, requests have at most 8,000 serialized UTF-8 bytes. The validator accepts at
  most twelve history entries; `createGameBridge` sends the last eight with
  summaries capped at 240 characters. Responses allow at most 600 speech
  characters; HTTP reads stop above 8,192 bytes.
- Each connection namespaces request identities. A game's local request label is
  not an HTTP idempotency key or a guarantee of exactly-once execution.
- The bridge has an eighteen-second local deadline. Invalid replies, transport
  failures and timeouts produce explicitly labeled fallback. Abort/dispose
  rejects pending work and suppresses late delivery instead. Local cancellation
  does not prove remote inference or host execution stopped.
- `report` deduplicates IDs within a connection and forwards at most 128 bounded
  observations. Reports/history are untrusted browser text, not authoritative
  protocol execution receipts. `onSpeech` means callback receipt, not confirmed
  display, adoption or human reading.

```ts
const bridge = createGameBridge({
  hostId: "original-example",
  character: { id: "companion", name: "Companion", temperament: "curious" },
  transport: async (request) => scenarioResponse(request),
  history: () => [],
  onObservation: (event) => console.log(event.kind),
  onSpeech: (reply) => console.log(reply.source),
  signal: lifetime.signal,
});
```

Here `lifetime` is an application-owned AbortController. A connected host replaces
the scenario transport with its authenticated composition. `createHTTPTransport`
uses same-origin requests; it does not implement cross-origin authentication,
CORS exceptions, provider selection or secret storage.

## Game modules and host authority

A game package exports `mount(container, options): Promise<MountedGame>`.
Options contain the injected `bridge`, `character` and mount AbortSignal.
`pause()` retains state and stops active input/simulation; `resume()` continues
that state. `destroy()` releases owned DOM, renderers, listeners and local work.
Hosts fence pending proposals against paused, replaced or destroyed state. A
late-loading module must clean up after abort. The application owns connection
and mount lifetimes, not this package.

All host life state machines, movement, combat, pathfinding, decks, rules and
scoring remain in the game. The SDK supplies bounded proposals/dialogue and
relays reports; it never executes game skills or grants control authority. Live
conversation and planning frequency are independent. The SDK receives neither
provider credentials nor an unrestricted memory archive.

The separate original Garden, Friendly 21 and Dungeon example repositories each
own their mechanics, narrow adapter and standalone shell. Standalone scenario
play needs no account. The private Website Playground imports their package interfaces and
injects its existing same-origin authenticated connection. An optional trusted
loopback development proxy is not a standalone cloud login solution.

## Build, distribution and limits

From this independent SDK checkout, run `pnpm install --frozen-lockfile`,
`pnpm build` to compile ESM/declarations, and `pnpm pack` to write an archive.
These commands do not publish. Package consumers install compiled files and need
no TypeScript compiler at runtime.

Full profile/identity negotiation, general intents, authoritative host adoption
and reconciliation, confirmed remote cancellation, permanent-memory transport
and commercial-game connectors remain outside this package. Server authentication,
provider selection, per-user/global quotas and storage belong to the composition
root. The generic SDK cannot bypass those boundaries.

### Optional game-owned dialogue presentation

`MountedGame.say?(speech)` is an additive experimental presentation hook. Existing
hosts implementing pause/resume/destroy remain valid. The application can deliver
player-requested chat through this method; each game owns its bubble, animation,
positioning, reduced-motion behavior and cleanup. It grants no action authority
and adds nothing to the bridge wire envelope. Game-requested dialogue is shown by
the host after its existing freshness checks. Silent planning results are valid.
The generic `scenarioResponse` supplies neutral authored speech and the advertised
fallback choice, without interpreting reports, cataloging worlds or claiming recall.
Hosts may inject a synchronous `fallback(request)` returning a validated response;
the SDK always labels it `fallback`. First-party game scenarios live in their owning
examples; cross-game authored fiction lives in Website composition.

## Standalone development

This public repository owns the SDK source, conformance tests and the synthetic
host under `apps/test-host`. It installs and builds without Core, App, Cloud or
Website checkouts and requires no account for its default scenario mode.

```sh
git clone https://github.com/openifsoul/sdk.git
cd sdk
pnpm install --frozen-lockfile
pnpm check
pnpm demo:host
pnpm pack
```

The generic scenario behavior is deliberately neutral. Hosts needing authored
domain reactions supply their own scenario transport or fallback.

### Non-browser hosts

`@ifsoul/adapter-sdk/bridge` exposes the bounded connection, validators, transport
and character/report types without importing browser mounting declarations.
The root keeps the existing `MountGame`/`HTMLElement` browser types for compatibility.
Node hosts use standard Fetch/Abort APIs (Node 22+) and matching Node type definitions;
no DOM runtime, game engine or built-in world ID is required. This narrow bridge is
not full production support for every game/service: negotiation, authority, authentication,
identity mapping and lifecycle integration still belong to each host composition.

The synthetic CLI optionally uses `IFSOUL_DEMO_SERVER` with `/api/bridge` and
explicit `IFSOUL_DEMO_PROVIDER` and `IFSOUL_DEMO_MODEL` selections. Without a
server, the CLI uses its local synthetic transport. A composition may accept an optional
`IFSOUL_DEMO_TOKEN` bearer credential; the SDK does not assume a particular identity
provider. The local self-hostable App supplies this endpoint. Managed compositions
may expose a different endpoint and must provide their own transport integration.

### Connect the CLI to the public local App

Start the independent public `openifsoul/app` checkout with `pnpm start`
(default `http://127.0.0.1:8788`). In App Settings, connect local Ollama and
select a model already installed in Ollama. Then, from this SDK checkout:

```sh
IFSOUL_DEMO_SERVER=http://127.0.0.1:8788 \
IFSOUL_DEMO_PROVIDER=ollama \
IFSOUL_DEMO_MODEL=qwen3:8b \
pnpm demo:host
```

Replace `qwen3:8b` with an available model shown in App Settings. This may invoke
three real generations (two decisions and one chat); model availability, speed
and output remain provider-dependent. The CLI sends explicit `provider` and
`model` query parameters to the public `/api/bridge` endpoint. Server mode rejects
missing/unsupported selection configuration rather than selecting `scenario`.
Local Ollama requests use a 60-second host deadline; other connections retain the
SDK's default 18-second deadline. Neither deadline guarantees inference stopped
remotely after fallback. Without `IFSOUL_DEMO_SERVER`, `pnpm demo:host` remains a
free deterministic scenario with no model or account.

This path needs only the public App and SDK checkouts plus local Ollama; it
requires no private Website/Cloud checkout, hosted account or provider credential
inside the SDK. App owns provider configuration and memory. The three standalone
example shells currently offer scenario play or an already configured
`/api/demo/bridge` proxy via `IFSOUL_API_ORIGIN`; they do not expose generic App
provider/model/language/timeout settings. An integrator can pass `language` and
`requestTimeoutMs` directly to `createGameBridge` in its own composition.

The [Minecraft + Mineflayer bridge guide](docs/mineflayer-bridge.md) describes
host identity, observations, transport and resource-budget integration.

## Server-side memory continuity

The SDK relays attributed observations; it owns no memory store or inference
engine. App composes persistent evidence, bounded episodes, scoped recall and
revisable interpretations behind a trusted owner store. See the
[App memory architecture](https://github.com/openifsoul/app/blob/main/docs/memory.md)
for the diagram, portable relationship scope, reset and remaining limits.
Observation delivery/authentication and stable player identity mapping remain
composition responsibilities.

The legacy alias allows hosts to set `createGameBridge({ requestTimeoutMs })` to an integer from 1 to 60000 milliseconds. The default remains 18000 milliseconds. For example, a localhost composition may select 35000 milliseconds for a slower local model. This host-side time budget does not change the bridge wire format or grant authority; cancellation and fallback remain enforced.

For operator-configured limits, runtime server capability and the supported buffered boundary, see [resource budgets](docs/resource-budgets.md). Default envelopes remain unchanged; larger HTTP packets do not imply larger model context.

## Compatibility

See [compatibility](docs/compatibility.md) for supported bridge inputs and
migration. Matching release identifiers do not make different format families
interchangeable.
