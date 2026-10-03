---
description: Control Nuclear from scripts and other tools via the HTTP API.
---

# HTTP API

When Nuclear Jam is enabled, Nuclear exposes a local HTTP API on the same server that serves the remote control UI. You can use it to build your own integrations, scripts, or alternative remotes.

Enable Nuclear Jam in Settings, then Integrations. The **API URL** field shows the base URL (e.g. `http://192.168.1.42:4120/api`).

## Authentication

Every endpoint except `GET /api/health` and `POST /api/pair` requires a paired device.

1. In Nuclear, open Settings, then Integrations, and click **Pair a new device**. Nuclear shows an 8-character code that works once and expires after 5 minutes.
2. Send `POST /api/pair` with `{ "code": "ABCD2345", "deviceName": "My script" }`. On success Nuclear sets an `HttpOnly` cookie called `nuclear_device`. Keep it and send it with every later request (for example with `curl -c jar -b jar`).
3. Every `POST` and `DELETE` must also include the header `X-Nuclear-Client: remote`. Requests without it get `403`.

Five wrong codes in a row cancel the active code (`429`); create a new one in Nuclear. Revoke a device in Settings, then Integrations, or call `DELETE /api/me` from the device itself.

Paired devices can only change settings under `core.playback.*` through `POST /api/settings/{id}`, and can only read the settings the remote UI needs (`core.playback.*`, the language, and the theme) through `GET /api/settings/{id}`.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/pair` | `{ "code": string, "deviceName": string }` | `{ "deviceId": string, "name": string }` and the device cookie. `401` for a wrong or expired code, `429` after too many wrong codes, `400` for an empty name |
| GET | `/api/me` | none | `{ "deviceId": string, "name": string }`, or `401` if this device is not paired |
| DELETE | `/api/me` | none | `204`, unpairs the calling device |

## Endpoints

### State

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | `{ "status": "ok", "apiVersion": number }`. No pairing needed |
| GET | `/api/queue` | `{ "items": QueueItem[], "currentIndex": number }` |
| GET | `/api/playback` | `{ "status": string, "seek": number, "duration": number }` |
| GET | `/api/settings` | `{ "shuffle": boolean, "repeat": string, "discovery": boolean, "language": string, "dark": boolean, "themeId": string }` |
| GET | `/api/settings/{id}` | The value of a single setting by its fully-qualified ID (e.g. `core.playback.shuffle`). `403` for settings a paired device may not read |

### Actions

All action endpoints return `200 OK` with no body on success.

| Method | Path | Body | Effect |
|--------|------|------|--------|
| POST | `/api/playback/play` | none | Start playback |
| POST | `/api/playback/toggle` | none | Toggle play/pause |
| POST | `/api/playback/next` | none | Skip to next track |
| POST | `/api/playback/previous` | none | Go to previous track |
| POST | `/api/playback/seek` | `{ "seconds": number }` | Seek to position |
| POST | `/api/playback/shuffle` | `{ "enabled": boolean }` | Set shuffle on or off |
| POST | `/api/playback/repeat` | `{ "mode": "off" \| "all" \| "one" }` | Set repeat mode |
| POST | `/api/queue/add` | `{ "tracks": Track[] }` | Append tracks to the queue |
| POST | `/api/queue/remove` | `{ "ids": string[] }` | Remove items from the queue by ID |
| POST | `/api/search` | `{ "query": string, "types"?: SearchCategory[], "limit"?: number }` | Search for music. Returns `{ "tracks"?: Track[], "artists"?: ArtistRef[], "albums"?: AlbumRef[], "playlists"?: PlaylistRef[] }` |
| POST | `/api/settings/{id}` | JSON value | Set a single setting by its fully-qualified ID |

### Events (SSE)

`GET /api/events` opens a Server-Sent Events stream. The server pushes named events whenever state changes in Nuclear.

Three event types:

{% code title="queue" %}
```
event: queue
data: {"items":[...],"currentIndex":3}
```
{% endcode %}

{% code title="playback" %}
```
event: playback
data: {"status":"playing","seek":42.1,"duration":213.0}
```
{% endcode %}

{% code title="settings" %}
```
event: settings
data: {"shuffle":false,"repeat":"off","discovery":false,"language":"en_US","dark":false,"themeId":"default"}
```
{% endcode %}

Events carry the full state for their domain in JSON.

## Errors

Failed requests return a JSON body with an `error` field:

```json
{ "error": "Playback.toggle failed: no track in queue" }
```

The status code is `500` for bridge errors (the command reached Nuclear but failed) and standard HTTP codes for anything else. Authentication errors use `401` with `{ "error": "unauthorized" }` and `403` with `missing_client_header`, `setting_not_readable` or `setting_not_writable`.
