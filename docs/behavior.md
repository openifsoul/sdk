# Behavior configuration host port

`createBehaviorClient(port)` preserves a service's typed
`BehaviorHostPort<Snapshot, Configuration, Inspection>`. `read`, `update` and
`inspect` use the same persisted source as the App editor; there are no SDK-owned
defaults or a second configuration store.

```ts
import { createBehaviorClient } from "@ifsoul/adapter-sdk";
const behavior = createBehaviorClient(trustedService.port);
const snapshot = await behavior.read();
const config = structuredClone(snapshot.config);
config.revision++;
config.defaults.policy.provocation.speak = false;
await behavior.update({ expectedRevision: snapshot.config.revision, config });
```

The transport closure authenticates and authorizes the tenant owner. Body IDs,
model output and host names cannot grant configuration rights or raise injected
operator ceilings. Ordinary host observation/generation remains session-scoped.
Directed relationships use stable verified participants, not display names or
character profiles. Private relations are not a group-planner input.

Core owns the [versioned configuration, parameter and reaction contracts](https://github.com/openifsoul/core/blob/main/docs/behavior.md).
App owns the [authenticated editor/service composition](https://github.com/openifsoul/app/blob/main/docs/behavior.md).
Goals and policy never add host capabilities. A denied reaction can still be
remembered and influence an authorized bounded relationship update; a proposal
never establishes execution or successful effects.
