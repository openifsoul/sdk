# First external bridge: Mineflayer authoring plan

Status, 2026-11-08: **documentation and implementation plan; no Mineflayer adapter
or Minecraft runtime acceptance exists in this repository**. The first target is
one Mineflayer **client/player bot**, with an original IfSoul character and
requested text dialogue in an authorized disposable Java server. This does not
control arbitrary server NPCs. There is no connector install or launch command.

This guide belongs to the public SDK because it describes host composition.
It needs only public SDK/App interfaces; private Website and Cloud are optional
hosting compositions. Follow the [general bridge authoring guide](https://github.com/openifsoul/core/blob/main/docs/bridge-authoring.md)
and [current roadmap](https://github.com/openifsoul/core/blob/main/docs/roadmap.md).
The experimental `ifsoul-bridge/0.3.0` application envelope is separate from Core's
current document family; both share IfSoul 0.3.0 while retaining different shapes.
Historical inputs are covered by [compatibility](compatibility.md).

## Choose the proof environment

Record these prerequisites before authorizing implementation:

- Server-owner permission, a disposable world, exact Java server version and
  server/plugin rules permitting a bot connection and bounded text messages.
- One permitted bot account and one consenting player. Use upstream Microsoft
  authentication when required; an explicitly isolated offline test server is a
  separate trust choice. A displayed username/offline UUID cannot authenticate an
  IfSoul owner. Keep token caches and device-code login outside prompts and logs.
- Node compatible with both checked-out manifests (SDK currently requires
  > =22.18). Proposed Mineflayer pin: **4.39.0**, release commit
  > `c168635cf2f6602069fc5e408bec864702335581`. Its [manifest](https://github.com/PrismarineJS/mineflayer/blob/c168635cf2f6602069fc5e408bec864702335581/package.json)
  > requires Node >=22. Pin transitive dependencies in the future composition's
  > lockfile. No Mineflayer dependency is added to the SDK by this guide.
- One original character, explicit memory selection, authorized recipients and
  storage/retention policy. Never bundle game assets, copied NPC biographies or
  authentication data. Mineflayer's [MIT license](https://github.com/PrismarineJS/mineflayer/blob/5a252e6d258882b042e60e21c37d552cdf3b3380/LICENSE)
  does not establish redistribution rights for every game/plugin/asset.

Research inspected the [upstream API at development commit
5a252e6](https://github.com/PrismarineJS/mineflayer/blob/5a252e6d258882b042e60e21c37d552cdf3b3380/docs/api.md).
It exposes bot construction, chat and lifecycle events. This is source evidence,
not a stable-release feature audit or a tested Minecraft version matrix. Before
implementation, check each required event/method against the pinned release;
record the exact server/account/dependency tuple. Bedrock, mod loaders and speech
services are outside this first proof.

## What can be run now

These commands exercise **existing public tooling**, not a Minecraft adapter.
In an independent public SDK checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo:host
```

With no server variable, the CLI uses deterministic scenario replies and no model.
To exercise the existing public App transport, follow the
[SDK local-App instructions](../README.md#connect-the-cli-to-the-public-local-app)
and [App setup](https://github.com/openifsoul/app/blob/main/README.md).
App owns `pnpm start`, loopback storage and Settings. Configure local Ollama and an
already installed model there, then run in the SDK checkout:

```sh
IFSOUL_DEMO_SERVER=http://127.0.0.1:8788 \
IFSOUL_DEMO_PROVIDER=ollama \
IFSOUL_DEMO_MODEL=qwen3:8b \
pnpm demo:host
```

Replace the model identifier with one actually available in Settings. This CLI
performs two synthetic decisions and one chat and can invoke three generations;
it does not connect to Minecraft. Local Ollama availability, latency and reply
quality require separate real-model evidence. No model download is implied.

The SDK is not published to npm. Future compositions should consume reviewed
built archives with pinned checksums/provenance as described in the
[SDK distribution instructions](../README.md#build-distribution-and-limits).
Do not invent an `@ifsoul/mineflayer` package or treat a source checkout as a
published dependency. This guide is repository documentation; the current package
archive does not include `docs/`.

## Architecture and missing adapter work

The external Node composition must implement the following flow. The arrows are
a design description, **not executable code or a new protocol**:

```text
permitted host event
  -> authenticated attribution + authorized bounded context
  -> SDK chat / speak / decide through configured transport
  -> validated model/scenario/fallback response
  -> host freshness + recipient + legality check
  -> host-owned presentation or permitted executor
  -> observed delivery/outcome, attributed report and scoped history
  -> App-owned bounded memory, where accepted by the composition
```

The existing [`@ifsoul/adapter-sdk/bridge` exports](../src/bridge.ts) provide
`createGameBridge`, `createHTTPTransport`, `scenarioResponse`, validators and
non-browser types. `chat(message)` is a player utterance; `speak` is host scene
context; `decide` offers a bounded host-owned choice set and fallback. Use these
meanings consistently. The adapter must not convert ambient server chatter into
player requests, loop on its own messages or interpret model speech as commands.

| Concern     | Existing public building block                  | Work required in the external composition                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Observation | SDK history/report attribution types            | Select consenting player events, distinguish private/public messages and supply bounded context   |
| Dialogue    | `chat`, `speak`, validated speech/source        | Bind requester and recipient, rate-limit, reject stale output and use permitted host presentation |
| Transport   | App `/api/bridge`; injectable `BridgeTransport` | Explicit endpoint/provider/model selection and correct authenticated fetch integration            |
| Identity    | Character ID, optional memory ID, host ID       | Trusted player/account mapping, world/embodiment binding and session epoch outside the envelope   |
| Lifecycle   | AbortSignal and bridge disposal                 | Listener cleanup, queue cleanup, invalidation, reconnect/backoff and uncertainty reconciliation   |
| Outcome     | `report`, bounded history callback              | Record actual host observation, retain attribution and route authorized evidence to the App       |

`onSpeech` proves callback receipt only. Sending chat is not proof that a player
received or read it. `report` is a bounded host claim, not an authoritative v0.2
execution receipt; its callback alone does not durably store an event. The SDK
owns neither Minecraft state nor memory storage. Validate the selected App memory
and trusted owner routing separately; see [App memory architecture](https://github.com/openifsoul/app/blob/main/docs/memory.md).

## Identity and privacy contract for the future composition

Keep a trusted binding record outside `BridgeRequest`: owner principal, selected
memory ID, character profile ID, server/world identifier, authenticated bot UUID,
permitted player UUID, current dimension/embodiment and connection epoch. A
character, memory selection, model and player account are different identities.
Only the trusted host maps them; strings received in game chat cannot grant scope.
The current envelope has no general environment/embodiment negotiation handshake.

Observe only what this bot is entitled to know. Do not dump the world, unrelated
players' inventory/chat or full memory archives. Private whispers must remain in
the authorized character/player scope and must never be echoed into public chat.
Record unknown attribution as unknown. Treat player messages, signs, item names,
server text and capability descriptions as untrusted data: they cannot rewrite
trusted instructions, select an owner, expand limits or authorize tools.

Keep dialogue text bounded and sanitize it for the chosen server channel. Reject
command-like model output and unsupported recipient/channel combinations. Secrets,
login URLs/device codes and provider keys stay outside model context and evidence
logs. Use synthetic text and redacted IDs in shareable proof logs.

## Lifetimes, budgets and safe recovery

Wait for the host's playable spawn boundary; login alone is insufficient. Maintain
an epoch captured with each request. Death, respawn/dimension changes, kick,
connection end, world change or replacement invalidates outstanding proposals and
recipient bindings. Abort/dispose old SDK connections, remove owned listeners and
cancel queued work before establishing a fresh binding. The upstream lifecycle
API supplies events; it does not implement this recovery policy.

Before presentation/adoption, compare the captured epoch, current actor/recipient,
context revision, deadline and capability revision. A local SDK timeout or abort
does not prove remote inference stopped. Drop late output. Restart with a fresh
session and re-observe host state; never replay uncertain side effects blindly.
Persist adapter event/request/outcome correlation where restart deduplication is
needed. SDK per-connection IDs/report dedupe are not durable exactly-once behavior.

Start with one in-flight dialogue request, a small bounded queue, explicit
per-player cooldown and no model request on a physics tick. Bound context/history,
reply size, request frequency, session count and deadlines. Set a measured model
budget before real calls: input/output tokens, concurrency, call count and, for
paid inference, currency cap. A byte limit is not a token/cost guarantee.

Use current [SDK budget and transport documentation](../README.md), declarations
and server capability policy when configuring limits. Host and server must agree;
raising a local limit cannot raise server/model permissions. Log requested and
effective limits and explicit rejection/fallback. Do not treat resource-limit
discovery as authentication or Minecraft action-capability negotiation. Those are
separate composition responsibilities. A slower local model requires coherent
host/server/provider deadlines, not unbounded retries.

Local/self-host App with local Ollama is the first placement. Network BYOK keeps
provider credentials in the trusted App composition and introduces network/data
and spend review. Managed hosting additionally needs verified owner auth, quotas
and storage routing; the local App must not simply be exposed publicly. Provider
placement never grants game-control authority. None establishes a Mineflayer
connector merely because the endpoint returns text.

## Stages and acceptance evidence

1. **Adapter fixtures, before a game.** Implement the missing Node composition
   using synthetic host events and deterministic transport. Verify attribution,
   bounded queues, rejection, timeout, late replies, private recipients, self-message
   suppression, epoch fencing and cleanup. Keep this separate from SDK unit tests.
2. **One authorized client, text only.** Record exact versions and permission.
   Demonstrate one original character answering one consenting player. Confirm
   host presentation and correctly scoped retained evidence. Exercise disconnect,
   death, dimension change, restart and unavailable/slow provider; no stale delivery,
   request storm, secret logging or automatic side-effect replay. Run deterministic
   host proof first, then separately authorized real-model proof with spend cap.
3. **One existing host-owned action, later.** Choose an executor already owned by
   the host; advertise a tiny allowlist with bounded arguments and safe fallback.
   Prove illegal/unsupported rejection, recheck at adoption, and distinguish
   accepted/running/completed/failed/unknown through actual host outcomes. If no
   suitable controller exists, defer action support. Do not add movement, combat,
   pathfinding or NPC life controllers to IfSoul to fill the gap.
4. **Two clients and live/batch, later.** Two bots are two player connections and
   may need separate accounts/permission. Prove private scope isolation, membership
   changes, fair scheduling, partial failures, per-item deadlines and cancellation.
   A persistent logical channel does not imply a streaming socket implementation;
   on-demand batch does not imply a provider Batch API or atomic group execution.
   Neither is implemented by the current one-character envelope.

For every run, retain a redacted receipt: source/artifact hashes, exact server and
runtime versions, deterministic versus real-model mode, selected profile/memory
aliases, effective limits, event/request/epoch correlation, response source,
latency, host adoption/delivery/outcome and cleanup result. Record cancellation
and unknown outcomes explicitly. Separate source checks, synthetic tests,
real-model App checks and actual server evidence. A successful CLI, README or
provider reply cannot substitute for the last layer.

Completion requires documented adapter fixtures and authorized native receipts
for the claimed version/scope. Until then, describe this as a Mineflayer bridge
plan. Mantella and other hosts retain their separate research/acceptance gates;
this guide makes no compatibility claim for them.
