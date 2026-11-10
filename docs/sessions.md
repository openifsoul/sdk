# Session host port

`SessionHostPort<Session, Event, Turn, Projection>` is a typed host boundary for
`transition`, `append`, `history` and `converse`. `createSessionClient(port)`
preserves those parameter/result types and clones inputs before forwarding them.
The service composition supplies the Core domain types; the SDK does not duplicate
Core schemas or depend on adjacent source checkouts.

```ts
import { createSessionClient } from "@ifsoul/adapter-sdk";
const client = createSessionClient(trustedService.port);
await client.append(addressedEvent);
const proposal = await client.converse({ ticket, outputEventId: "reply-1" });
```

Authenticate and authorize the host in the service/transport closure. Participant
IDs in event data do not authenticate players. A trusted server identity directory
registers verified subjects and maps them to stable participants independently of
names, profiles and embodiments. Never serialize trusted access into a browser
request or allow a player to call trusted host registration directly.

Core owns the [session domain](https://github.com/openifsoul/core/blob/main/docs/sessions.md).
App offers the [persistent composition](https://github.com/openifsoul/app/blob/main/docs/sessions.md).
Groups and channels remain separate from event audiences. Membership transitions
are explicit and revisioned; dialogue proposals preserve host adoption and effect
semantics. Existing `createGameBridge` clients retain their solitary behavior.

The [App executable synthetic host](https://github.com/openifsoul/app/blob/main/apps/runtime-host/src/session-demo.ts)
wires two NPCs and two players with complete typed objects and an in-memory store.
Run it in an independently installed App checkout with
`pnpm exec tsx apps/runtime-host/src/session-demo.ts`.

See [group planning and autonomous cadence](group-scheduler.md) for the additive planning API.
