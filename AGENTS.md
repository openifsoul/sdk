# IfSoul SDK

Public experimental bridge SDK and synthetic test host. Host games own mechanics,
NPC state machines, movement, combat and pathfinding; SDK proposals confer no
execution authority. Keep the `ifsoul-bridge/0.1` API compatible with version
0.1.0-alpha.1 and the three original example packages. Normative protocol bytes
belong to Core and must not be copied or silently changed here.

Checks run locally: `pnpm install --frozen-lockfile`, `pnpm check`, and
`pnpm demo:host`. Build with `pnpm build`; create reviewed distribution archives
with `pnpm pack`. No npm publication, automatic CI, remote builds, schedules or
deployments. Public repository creation and reviewed commits/pushes to
https://github.com/openifsoul/sdk were authorized on 2026-11-06. Never commit
secrets, personal data, generated logs, node_modules or unreviewed archives.

## Authorized release on 2026-11-06

The owner authorized preparation, reviewed Git commits/pushes, and manual production
publication through private Cloud after coordinator review and local gates. This
supersedes the split-only deployment restriction for this release. Checks and builds
remain local; no npm publication, automatic remote execution, settings changes,
secret operation or data migration is authorized. A Git push does not deploy.
