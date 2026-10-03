---
description: Use Nuclear Jam away from home through Tailscale, and install it on your phone's home screen.
---

# Remote access with Tailscale

Nuclear Jam normally works only on your home network. With [Tailscale](https://tailscale.com), your phone can reach Nuclear from anywhere, over an encrypted connection that only your own devices can use. Nothing is opened to the public internet.

Tailscale also gives Nuclear Jam an `https://` address. Your phone needs HTTPS to install Nuclear Jam as an app on its home screen.

## What you need

- Tailscale installed and signed in on the computer that runs Nuclear.
- The Tailscale app installed and signed in on your phone, using the same account (tailnet).
- Nuclear Jam turned on in Settings, then Integrations.

## 1. Turn on HTTPS for your tailnet

In the Tailscale admin console, open **DNS** and make sure **MagicDNS** is on. Then turn on **HTTPS Certificates** on the same page.

## 2. Share Nuclear Jam with your tailnet

Look at the **API URL** in Settings, then Integrations, and note the port. It is usually `4120`. Then run this on the computer that runs Nuclear:

```bash
tailscale serve --bg 4120
```

Run `tailscale serve status` to see the address Tailscale created. It looks like `https://my-computer.tail1234.ts.net`. Open it in a browser on another device on your tailnet to check that it works.

{% hint style="danger" %}
Use `tailscale serve`, never `tailscale funnel`. Funnel publishes the address to the whole internet.
{% endhint %}

## 3. Tell Nuclear about the address

In Settings, then Integrations, paste the address into **Remote address**. QR codes and pairing links now use it instead of your local network address, so they work wherever your phone is.

Optional: turn on **Tailnet only**. Nuclear Jam then only accepts connections from this computer, which is where Tailscale Serve forwards them from. Other devices on your home Wi-Fi can no longer reach Nuclear Jam directly.

## 4. Install and pair your phone

1. In Nuclear, open Settings, then Integrations, and click **Pair a new device**.
2. On your phone, with Tailscale connected, scan the QR code or open the pairing link.
3. On iPhone or iPad, tap **Share**, then **Add to Home Screen**, and open Nuclear Jam from the new icon. On Android, use **Install app** or **Add to Home screen** from the browser menu.
4. Pair from the installed app: enter the code shown in Nuclear and tap **Pair**.

Pair from the home screen app, not from the browser tab you used to install it. iOS keeps the two separate, so a pairing made in Safari does not carry over.

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| "Could not connect to Nuclear" | Tailscale is connected on your phone, Nuclear is running on your computer, and Nuclear Jam is on. |
| The address stopped working after a restart | Nuclear picks the first free port from 4120 to 4129. If the port in the API URL changed, run `tailscale serve --bg <new port>` again. |
| The phone keeps asking for a pairing code | The device was revoked, or it was paired in the browser instead of the home screen app. Pair it again. |
| Running Nuclear with `pnpm dev` | The remote UI comes from the Vite dev server on port 5173, so serve that port instead: `tailscale serve --bg 5173`. |
