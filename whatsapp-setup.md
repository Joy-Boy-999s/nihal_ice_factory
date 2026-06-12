# WhatsApp Setup — Nihal Ice Factory

This guide wires the app to the **Meta WhatsApp Business Cloud API** so that:

1. **Customers can order over WhatsApp** — registered customers message the factory
   number, get a menu of their usual plant's ice with live prices, and place real
   orders (`ORDER 5 TUBE`) that go through the same stock checks, FIFO holds,
   discounts and operator notifications as in-app orders (pay-on-delivery).
2. **Notifications mirror to WhatsApp** — every in-app notification (order placed /
   paid / ready / cancelled) is also sent to the recipient's WhatsApp if their
   account has a linked mobile.

Everything stays **dormant until the env vars are set** — the app runs fine without it.

---

## How access control works (no setup needed)

Only registered accounts can use WhatsApp ordering. The sender's WhatsApp number must
match the `mobile` linked to a user:

- **Customers** are linked automatically the first time they place an order in the web
  app (the mobile they enter while logged in is saved to their account).
- **Anyone** (staff included) can link a number manually: user menu → **Link WhatsApp
  number**.
- Unknown numbers receive a polite "register first" reply and cannot order.

---

## Part 1 — Create the Meta app

1. Go to https://developers.facebook.com → **My Apps** → **Create App**.
2. Choose **Business** as the app type, give it a name (e.g. `nihal-ice-factory`).
3. In the app dashboard, find **WhatsApp** in the product list and click **Set up**.
   You'll be asked to create/select a **Meta Business Account** — accept the default.

Meta gives you a free **test phone number** immediately — good enough for full
end-to-end testing.

## Part 2 — Collect the four values

From **WhatsApp → API Setup** in the app dashboard:

| Value | Where to find it | Env var |
|---|---|---|
| Phone Number ID | shown under the test number (NOT the phone number itself) | `WHATSAPP_PHONE_NUMBER_ID` |
| Access token | "Temporary access token" button (⚠️ expires in 24 h — see Part 6 for a permanent one) | `WHATSAPP_ACCESS_TOKEN` |
| App secret | **App Settings → Basic → App Secret** (click Show) | `WHATSAPP_APP_SECRET` |
| Verify token | **you invent this** — any random string; Meta echoes it during webhook verification | `WHATSAPP_VERIFY_TOKEN` |

While on the API Setup page, also add your own WhatsApp number under
**To** → **Manage phone number list** — test numbers may only message up to
**5 allow-listed recipients**.

## Part 3 — Configure the webhook

The backend exposes `GET/POST /whatsapp/webhook` (public; POST is HMAC-verified).

1. In the app dashboard: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL**: `https://<your-backend>/whatsapp/webhook`
   (e.g. your Render URL — must be HTTPS and publicly reachable).
3. **Verify token**: the exact string you chose for `WHATSAPP_VERIFY_TOKEN`.

   > Set the env vars on the server **before** clicking Verify — Meta calls the
   > endpoint immediately and the backend compares against `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verify and save**.
5. Under **Webhook fields**, subscribe to **`messages`** (only this field is needed).

## Part 4 — Set the environment variables

On **Render** (or `packages/services/.env` locally):

```env
WHATSAPP_VERIFY_TOKEN=<the string you invented>
WHATSAPP_ACCESS_TOKEN=<token from API Setup>
WHATSAPP_PHONE_NUMBER_ID=<phone number id>
WHATSAPP_APP_SECRET=<app secret>
# Used in WhatsApp replies for "track your order" links
APP_WEB_URL=https://nihal-ice-factory.vercel.app
```

Restart the backend. The boot log should show:

```
[WhatsappService] WhatsApp notification mirroring active
```

(If it doesn't appear, `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` is missing.)

## Part 5 — Test the flow

1. Make sure your personal WhatsApp number is **allow-listed** (Part 2) **and linked
   to an account** (place one order in the web app with that mobile, or use
   user menu → Link WhatsApp number).
2. From WhatsApp, message the test number: `hi`
   → you should get the greeting + ice catalog for your usual plant.
3. Reply `ORDER 2 <code from the menu>`
   → "✅ Order #N placed!" with the total and discount; the operator's bell rings
   and the order appears on the staff Orders page.
4. Fulfill or cancel the order in the app → a WhatsApp status message arrives
   (this is the notification mirroring).

## Part 6 — Going to production

- **Permanent token**: the API Setup token dies after 24 h. Create a permanent one via
  **Business Settings → Users → System Users** → Add → assign the app with
  **whatsapp_business_messaging** permission → Generate Token (no expiry). Put that in
  `WHATSAPP_ACCESS_TOKEN`.
- **Real number**: add and verify your business phone number under
  **WhatsApp → API Setup → Add phone number** (a number not currently registered on the
  consumer WhatsApp app). Update `WHATSAPP_PHONE_NUMBER_ID` to the new number's ID.
- **Business verification** in Meta Business Manager lifts the 5-recipient /
  messaging-tier limits.

### The 24-hour window (important)

Meta only allows **free-form** business messages within 24 hours of the customer's
last inbound message. This means:

- **Ordering** always works (it's a direct reply).
- **Notification mirroring** works reliably for anyone who has messaged the number in
  the last 24 h. Outside that window Meta rejects the send (error 131047) and the
  notification simply stays in-app — nothing breaks, the WhatsApp copy is skipped.
- To guarantee delivery outside the window you'd need pre-approved **template
  messages** — a possible future enhancement, not currently implemented.

## Local development

Meta requires a public HTTPS callback, so tunnel your local backend:

```bash
# any tunnel works — e.g.
npx cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Use the generated `https://...` URL + `/whatsapp/webhook` as the Callback URL, set the
env vars in `packages/services/.env`, and restart `nx serve services`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Webhook "Verify and save" fails | `WHATSAPP_VERIFY_TOKEN` on the server doesn't match what you typed in Meta, or the backend isn't reachable / wasn't restarted after setting env vars |
| Backend logs `Invalid webhook signature` (401) | `WHATSAPP_APP_SECRET` is wrong — copy it again from App Settings → Basic |
| Messages to the bot get no reply | Webhook field **messages** not subscribed; or sender's number isn't linked to any account (check `users.mobile`); or access token expired (temporary tokens last 24 h) |
| `(#131030) Recipient phone number not in allowed list` | Test numbers only message allow-listed recipients — add the number in API Setup |
| Error 131047 on outbound sends | Outside the 24-hour customer-service window — expected; see Part 6 |
| Replies arrive but ordering fails | Check the backend log line from `CustomerService.placeOrder` (e.g. insufficient stock) — the bot relays the same message |

All webhook traffic and send failures are visible in the backend log stream
(`[WhatsappService]` entries, plus the standard `[HTTP]` request lines).
