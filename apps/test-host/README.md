# Standalone test host

A separate Node process using only the experimental adapter SDK. The host owns
water inventory, bed state, preconditions and execution; IfSoul returns a bounded
choice. No game renderer, runtime implementation or provider client is imported.

From the repository root:

```sh
pnpm demo:host
```

The default runs the complete loop with a visibly deterministic scenario transport
and no network/model expense. To exercise the HTTP transport, set
`IFSOUL_DEMO_SERVER` to a running local/HTTPS demo server and
`IFSOUL_DEMO_TOKEN` to a current Clerk bearer session token through your private environment for cloud mode,
then run the same command. A trusted local loopback server requires no token. Do not commit or paste credentials into logs. The client
rejects redirects and insecure non-loopback servers. The host uses three bounded
requests: two choices and a conversation; failures are labeled fallback.

See [SDK](../../README.md) and
[demo deployment and budgets](https://github.com/openifsoul/core/blob/main/docs/browser-demo.md).
