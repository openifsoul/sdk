# Minecraft host integration

The [Minecraft player bridge](https://github.com/openifsoul/bridge-minecraft)
composes the bounded SDK with a Mineflayer player connection. Install and configure
that repository according to its setup reference.

The host owns server/player identity, permitted channels, connection lifecycle,
character/profile selection and all game mechanics. Configure explicit context and
history limits and an AbortSignal. Validate the selected recipient, world and
connection again before displaying a delayed reply. Forward observations as
attributed host reports; a model-generated statement does not establish an event.

Use `@ifsoul/adapter-sdk/bridge` for Node hosts. App mode supplies an authenticated
loopback transport with explicit provider/model selection and runtime resource
capabilities. Keep provider credentials in App, not in the host packet. Memory
import creates an untrusted filtered fork with a new identity, not a full backup
or same-identity restore. Local cancellation does not guarantee that provider-side
work or charges have stopped.

See [bridge resource budgets](resource-budgets.md) and the
[App memory reference](https://github.com/openifsoul/app/blob/main/docs/memory.md).

The App also supports server-side connector profiles for Citizens, Easy NPC,
CustomNPCs Unofficial and MineColonies. They use the App's scoped device API
from Java and do not import this SDK. See the
[App compatibility and setup guide](https://github.com/openifsoul/app/blob/main/docs/game-connections.md)
for pinned versions and native verification status.
