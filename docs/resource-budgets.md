# Runtime-configured bridge budgets

The SDK remains usable by arbitrary browser/Node hosts. It owns bounded transport,
not model inference, private quotas or host mechanics. The current
`ifsoul-bridge/0.4.0` envelope uses the common release identifier; default bounds
remain; obsolete format requests reject. See [compatibility](compatibility.md).

| Field                                                | Default   | Unit/meaning                      |
| ---------------------------------------------------- | --------- | --------------------------------- |
| `maxRequestBytes`                                    | 8,000     | Serialized UTF-8 envelope bytes   |
| `maxResponseBytes`                                   | 8,192     | Complete HTTP response bytes      |
| `maxContextChars`                                    | 1,200     | JavaScript string code units      |
| `maxHistoryEntries` / `sentHistoryEntries`           | 12 / 8    | Accepted / sent report rows       |
| `maxHistorySummaryChars` / `sentHistorySummaryChars` | 300 / 240 | Accepted / sent string code units |
| `maxSpeechChars`                                     | 600       | Response speech code units        |
| `timeoutMs`                                          | 18,000    | Host request wait in milliseconds |
| `maxSessionRequests` / `maxReports`                  | 128 / 128 | Per-connection bounds             |
| `maxReportChars`                                     | 600       | Input observation code units      |

The existing `requestTimeoutMs` alias retains its default and 1–60,000 ms range
when used without the new `limits` configuration. Explicit trusted `limits` can
select larger supported finite waits; conflicting aliases reject. Identifier,
role, choice-legality and attribution checks still apply.

## Operator configuration and server capability

Pass trusted host configuration to both the connection and built-in transport:

```ts
const limits = {
  maxRequestBytes: 65_536,
  maxContextChars: 4_000,
  timeoutMs: 120_000,
};
const transport = createHTTPTransport("/api/bridge", fetch, { limits });
const bridge = createGameBridge({ ...hostOptions, limits, transport });
```

This raises no server limit. When the built-in HTTP transport requests a bound
above the legacy defaults, it fetches the same-origin `/api/resource-policy`
metadata before POST, using the same injected fetch/authentication owner. A host
can configure `capabilityEndpoint` or inject a runtime `serverCapability` object.
Absent/unsupported capability rejects the increased request before POST; legacy
connections do not need this endpoint. Requested and advertised bounds are
intersected. `onBudget` observes requested/effective values; the actual request
must fit the effective policy. No field inside an envelope can raise a ceiling.

Capability metadata uses `ifsoul-bridge-resource-policy/0.4.0`, names the existing
bridge envelope version and the `buffered-json` transport. It contains finite
capacity metadata, not identity, credentials, permissions or raw quota ledgers.
A custom transport remains host-owned and must implement its own authenticated
capability/budget boundary; the SDK does not supply generic remote authentication.

The test-host CLI supports operator JSON at runtime, without editing source:

```sh
IFSOUL_BRIDGE_RESOURCE_POLICY_FILE=/absolute/path/bridge-resources.json \
IFSOUL_DEMO_SERVER=http://127.0.0.1:8788 \
IFSOUL_DEMO_PROVIDER=ollama IFSOUL_DEMO_MODEL=your-installed-model \
pnpm demo:host
```

The file is a partial `BridgeLimits` object, for example:
`{"maxRequestBytes":65536,"maxContextChars":4000,"timeoutMs":120000}`.
`IFSOUL_BRIDGE_RESOURCE_POLICY` accepts that JSON directly; use one source, not
both. `IFSOUL_DEMO_SHOW_BUDGET=1` prints safe requested/effective metadata. The
App operator must independently enable corresponding server limits. No models
are installed by this command, and model quality/latency is not guaranteed.

## Supported buffered boundary

The built-in transport supports at most 64 MiB per buffered JSON request/response;
configuration above it explicitly rejects as `unsupported-policy` before sending.
This is an implementation boundary, not a model token or machine-memory claim.
It is not a streamed 1 GiB pipeline. Buffered parsing needs additional memory
copies.
Larger streamed/chunked messages need a separately implemented transport/contract.

HTTP response reads reject an excessive Content-Length before accumulation and
cancel chunked bodies when their running byte count exceeds the effective limit.
`BridgeBudgetError` exposes `code`, `layer` and `field`; `onBudgetError` can inspect
transport failures that become labelled fallback. Abort/disposal still suppresses
late delivery. Cancellation cannot prove remote inference stopped.

An App adapter may advertise smaller structural bounds because current Core
messages remain limited. A larger SDK byte budget does not override those
contracts, App retention or model context. See the
[App guide](https://github.com/openifsoul/app/blob/main/docs/resource-budgets.md) and
[Core guide](https://github.com/openifsoul/core/blob/main/docs/resource-budgets.md).
