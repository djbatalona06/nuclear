# Security Policy

## Supported versions

Only the latest release receives security fixes. Update to the newest version from the [Releases page](https://github.com/djbatalona06/nuclear/releases) before reporting an issue.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: [Report a vulnerability](https://github.com/djbatalona06/nuclear/security/advisories/new). Do not open public issues or pull requests for security problems.

Include the version, your operating system, what you did, and what you expected to happen. A proof of concept helps. You will get an acknowledgement as soon as possible, and fixes are released before details are made public.

## What is in scope

- Nuclear Jam, the remote control server: pairing, device cookies, the HTTP API, and the installable web app.
- The local servers: MCP, MPD and the stream proxy.
- The in-app updater and the release pipeline.
- Anything that lets a website, another device, or another user on the network control Nuclear, read your data, or run code without your consent.

Plugins run with the same privileges as Nuclear. A malicious plugin is out of scope, so only install plugins you trust.

## How Nuclear protects you

| Surface | Default | Protection |
|---------|---------|------------|
| Nuclear Jam | Off | Every request needs a paired device. Pairing uses a single-use code that expires after 5 minutes and is burned after 5 wrong attempts. Devices get a random 256-bit token, stored only as a SHA-256 hash, and you can revoke any device in Settings, then Integrations. |
| Device cookie | n/a | `HttpOnly`, `SameSite=Strict`, scoped to `/api`, and `Secure` whenever the request arrives over HTTPS (for example through Tailscale Serve). |
| Jam API | n/a | State-changing requests need a custom header, so other websites cannot forge them. Paired devices can only read the settings the remote needs and only change playback settings. Responses are never cached and cannot be framed. |
| MCP server | Off | Listens on `127.0.0.1` only, and rejects requests whose `Host` or `Origin` is not local, which blocks DNS rebinding and cross-site requests from web pages. |
| MPD server | Off | Listens on `127.0.0.1` only, and drops connections that start with an HTTP request, which blocks cross-protocol attacks from web pages. |
| Stream proxy | On | Listens on `127.0.0.1` only. Only Nuclear's own pages may read from it, and requests with a non-local `Host` are rejected. |
| Updates | n/a | Update packages are signed. Nuclear refuses an update that was not signed with this project's key. |

## Limits you should know about

- **Plain HTTP on your home network.** Without Tailscale, Nuclear Jam uses plain HTTP, so anyone on the same Wi-Fi can observe pairing and the cookie. Pair only on a network you trust, or use [Tailscale](packages/docs/user-manual/remote-access.md) and turn on **Tailnet only**.
- **Never use `tailscale funnel`.** It publishes Nuclear Jam to the whole internet. Use `tailscale serve` only.
- **Local programs can use MCP and MPD.** Both are unauthenticated by design, like most MPD servers. Leave them off unless you use them.
- **Unsigned installers.** The Windows installer is not code-signed and the macOS build is ad-hoc signed, so the operating system will warn you the first time you open it.
