# Group scheduler host port

`createSchedulerClient(port)` preserves a composition's typed
`SchedulerHostPort<Config, Trigger, Claim, Report, Inspection, RunResult>`.
Operations are `configure`, `control`, `runDue`, `trigger`, `report`, `reconcile`
and `inspect`. Inputs are cloned before forwarding. The client creates no timer,
model retry, clock advance, fallback action or speech.

```ts
import { createSchedulerClient } from "@ifsoul/adapter-sdk";
const scheduler = createSchedulerClient(trustedService.port);
await scheduler.configure({ expectedRevision: 0, config });
const results = await scheduler.runDue();
```

The [complete executable App host](https://github.com/openifsoul/app/blob/main/apps/runtime-host/src/scheduler-demo.ts)
provides actual typed objects for one or two NPCs without players. In an installed
App checkout, run `pnpm exec tsx apps/runtime-host/src/scheduler-demo.ts 1` or use
`2` for the group. Core owns the [planning and cadence contracts](https://github.com/openifsoul/core/blob/main/docs/group-scheduler.md).

This is an authenticated host boundary. The transport closure establishes host
identity; body IDs do not authenticate actors. Only trusted server policy may
configure resource requests and ceilings. A model cannot add participants,
capabilities, permissions or schedule configuration. All NPC writer reservations
are atomic; group membership does not imply private memory sharing. Host adoption
and actual effects remain separate from proposal generation and due cadence.
