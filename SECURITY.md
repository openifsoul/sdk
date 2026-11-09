# Security

The SDK is an experimental bounded bridge, not a gameplay controller or security
boundary for an untrusted host. Hosts must validate current state and authority
before adopting proposals. Do not send API keys, private player conversations or
unbounded history through the bridge.

Report vulnerabilities privately to the repository maintainer
[h3lpkey](https://github.com/h3lpkey). Do not open a public issue containing secrets
or working exploit details. Repository security settings are managed separately.

The current normative contracts and runtime threat model belong to
[Core](https://github.com/openifsoul/core). No compatibility or security guarantee
for third-party game integrations is implied by the synthetic conformance tests.
