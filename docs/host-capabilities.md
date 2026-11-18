# Host capability discovery

The experimental capability types and validators are exported by
`@ifsoul/adapter-sdk/bridge`. A manifest contains a positive decimal revision
as a string, a host-defined world and embodiment ID, and bounded capability
descriptors. Intent IDs and categories are dot-qualified and open to host
namespaces. A descriptor uses the same typed parameter model as
`EnvironmentProfile.hostIntents`, with support and readiness reported separately.
Unsupported entries are unavailable. Partial or unavailable entries must
include a reason. Quantity parameters declare finite limits and a unit. The
host enforces concrete target visibility, integral counts where applicable,
game rules, and any on-server permissions.

App assigns the live provider ID during an authenticated native handshake. The
provider publishes complete replacement manifests and precedes each effect
with an authorization checkpoint. Use ascending per-operation checkpoints
starting at one. Preserve the selected provider, arguments and both revisions
throughout an operation. A denied, expired or ambiguous checkpoint response
stops the operation. A host may explicitly stop an operation locally and record
observed steps in a terminal cancelled, partial or failed report.

Reports have an operation ID, provider ID, report ID, intent ID, status and
bounded observed steps, with an optional verified count for each step. Reuse the
same report ID and payload if acknowledgement is uncertain. A terminal report
ends the operation. A subsequently observed effect may be recorded as late
evidence while its authenticated provider is still recognized. Retain evidence
for each step the host actually measured. For example, a movement goal being
accepted gives no arrival evidence. An item previously in the inventory gives
no collection evidence for a new operation.

The SDK test host includes a synthetic museum station to demonstrate a
non-game-specific descriptor and typed argument validation.
