# Project status and handoff (as of 7 Nov 2026)

Read this first if you are a new Claude session picking up the project. It records what is built, what was
decided and why, what is tested, and what is left. **Talk to the owner in Thai**; everything in the product,
repo and submission is in English.

## The project
- **What:** an online shop for Blue Sea Wood (family wood-slab maker in Phrae, Thailand), built for the
  **PayPal AI Hackathon** on Devpost (https://paypalaihackathon.devpost.com/).
- **Story (keep it consistent everywhere):** *"Sell one-of-a-kind, made-to-order goods online: AI finds the real
  piece, PayPal reserves it."* Ordinary e-commerce assumes identical products; every slab exists once and every
  table is finished to order. See README and `docs/SUBMISSION.md`.
- **Deadline:** 12 Nov 2026, 12:00 PST = **13 Nov 2026, 03:00 Thai time**. Aim to submit by the evening of 12 Nov.
- **Prize targets:** a Grand Prize or Honorable Mention (Best Use of Agentic Commerce, Most Impactful, Best Demo
  Delivery), plus a sponsor prize (**AG Grid**; **Render** credits). Sponsor rules only require "uses any AG Grid /
  Render tools". At most 1 main + 1 sponsor prize per project. Tick the sponsor prizes on the Devpost form.

## Where things are
| | |
|---|---|
| Live site | https://bluesea-slab-concierge.onrender.com (owner desk: `/owner`, MCP: `/mcp`, `/llms.txt`) |
| GitHub | https://github.com/314cc-star/bluesea-slab-concierge, **private for now; must be made public before submitting** |
| Render | workspace **BSW** (`tea-dbncaqp5efls73auiiog`), service `srv-dbneqfgu01pc73cih7n0`, Singapore, free plan, auto-deploys on push to `main` |
| PayPal | sandbox app with **Invoicing enabled**; sandbox Business = seller, sandbox Personal = test buyer |
| Gemini | free-tier key (billing **not** enabled) |

### Secrets
- Never commit `.env`; it is git-ignored. Copy it between machines by AirDrop/USB, never via GitHub or chat.
- Local `.env` keys: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
  `CURRENCY`, `DEPOSIT_RATE`, `PORT`, `ADMIN_KEY`, `DEMO_MODE`, `DEMO_RELEASE_MINUTES`, `ROOM_PREVIEW`, `USD_PER_THB`.
- **On Render the 4 secrets are stored as Secret Files, not env vars.** `server/secrets.js` loads them from
  `/etc/secrets/<NAME>`. The 9 non-secret values are normal env vars (see `render.yaml`).
- Don't enter secrets into third-party sites for the owner; they paste keys themselves.

## Run it
```bash
npm install
npm run dev        # shop http://localhost:5173, API :3001, owner desk /owner
npm run build && npm start   # production mode
```
`.claude/launch.json` (not in git) runs `npm run dev` on port 5173 for the preview pane.

## Code map
| File | What |
|---|---|
| `server/index.js` | Express API: stock, quotes, PayPal orders/capture (`completeDeposit`, idempotent), owner routes (refund, invoice, edit stock, add slab), demo-mode sweep, SEO routes. **`import './secrets.js'` must stay first.** |
| `server/options.js` | Legs, finishes, prices, policies (`CANCEL_DAYS = 3`), contact links, `custom_id` encoding (`slab|legs|finish|contact`) |
| `server/paypal.js` | Orders v2, Invoicing v2, Payments refund; token refresh + retry on 401/403 |
| `server/concierge.js` | Gemini agent (tools `search_slabs`, `start_checkout`), model fallback with cooldowns, always replies in English |
| `server/listing.js` | Photo-to-listing (Gemini vision, JSON schema, English only) |
| `server/visualize.js` | "See it in your room" (Gemini image models); hidden unless `ROOM_PREVIEW=true` |
| `server/mcp.js` | MCP server: `search_slabs`, `get_slab`, `create_deposit_checkout` (legs, finish, customer_phone), `check_checkout` |
| `server/seo.js` | schema.org JSON-LD, noscript list, `/llms.txt` |
| `server/store.js` | JSON-file store (`data/slabs.json`, `data/orders.json`), reservation timestamps |
| `client/App.jsx` | Shop, slab cards, photo viewer, reserve dialog (legs, finish, phone), promises, reviews |
| `client/Concierge.jsx`, `OrderConfirmation.jsx`, `CheckoutReturn.jsx`, `Dashboard.jsx` (AG Grid), `ListingWriter.jsx`, `RoomPreview.jsx` | UI parts |

## Business decisions (from the owner; don't change without asking)
- **Stock:** 8 real Suar (Monkey Pod) slabs in `data/slabs.json` with photos in `data/photos/`. IDs are the chalk
  numbers: BSW-177, 176, 175, 174, 132, 4, 3, 1. Widths are measured at both ends and the middle (`widths_cm`).
  BSW-4's length is recorded as 330 (chalk shows "300" above "330"; not confirmed).
- **Prices:** derived from the 2026 price list on blueseawood.co (7.5 cm table, width capped at 100 cm),
  then **−25% and rounded to the nearest 1,000 THB**: 24k, 25k, 24k, 24k, 26k, 29k, 32k, 32k.
- **Legs:** none / steel / wood, same price: **2,500 THB a pair for slabs ≤70 cm wide, 3,000 THB wider** (71–79 cm
  assumed 3,000). One pair per table; the shop confirms leg style before production.
- **Finishes:** 5 from blueseawood.co/en/wood-finish (matte lacquer standard, polyurethane, teak oil, natural oil,
  ultra-matte); **no extra cost**.
- **Deposit 50%** of slab + legs; balance invoiced before shipping.
- **Free delivery** anywhere in Thailand for every slab.
- **3-day reservation:** full refund if the customer changes their mind within 3 days; production starts after
  the 3 days and takes about 14 days.
- **Cracks** are stabilised with wooden bow ties; **lifetime free repair warranty**.
- Contact buttons: LINE `https://line.me/R/ti/p/@blueseawood`, WhatsApp `https://wa.me/66614702555`.
- **No Thai text** in the product for now, and **don't mention Lazada or Shopee** anywhere.

## Tested and working
Locally and on the live site: shop, filters, photo viewer, concierge chat (~4 s), legs/finish pricing,
phone required, PayPal deposit with real sandbox payment, delivery address saved from PayPal, confirmation page
(order number, address, dated timeline), owner desk with key, balance invoice (PayPal status SENT), refund
(slab back on sale), MCP tools (also from a real Claude session), llms.txt, robots.txt, JSON-LD, demo-mode
release. GitHub detects the MIT license.

## Known limits
- **Gemini free tier:** about 20 requests/day per flash model; lite models first. Recommend the owner enables
  billing before judging, which would also allow `ROOM_PREVIEW=true` (image models have 0 free quota).
- **Render free plan:** sleeps after 15 min idle (first load about 1 min); disk resets on each deploy, so orders
  and stock edits are not permanent. Fine for the demo; a database is needed for real use.
- Demo mode (on Render) releases reservations after 30 minutes.

## Left to do (in order)
1. ~~Demo video~~ **Draft uploaded: https://youtu.be/EsnNLFuDd98** (channel "Slab Concierge", 2:04). Story: many
   customers chat about the same slab; whoever pays the PayPal deposit first holds it for 3 days. Uses the owner's
   4 yard clips, simulated WhatsApp chats (labelled), original synthesized background music, no narration.
   **Caveat:** the site parts were recorded on a local server with scripted Gemini replies and a stand-in PayPal
   button (the live site was unreachable from that session). Replace them with real recordings of the live site
   (concierge answer, PayPal sandbox payment, Reserved badge, `/owner`) if time allows, then replace the video in
   YouTube Studio. Original plan for reference: Full kit in `docs/VIDEO.md`: shot list, 11-part English narration for
   text-to-speech, captions, editing steps, upload checklist. Plan agreed with the owner: the agent does the editing
   on this iMac with **Playwright** (automated screen recording of the live site), **HyperFrames** (title cards
   and captions in the brand style), **edge-tts** (narration) and **FFmpeg** (assembly, music, 1080p export).
   The owner films the yard shots (A1–A4) and, if needed, a 15-second PayPal payment clip; the agent cannot log
   into PayPal as the buyer. Ask before installing tools.
2. Keep-awake for the free Render service so judges don't wait (an external ping every ~10 min).
3. README: live URL and video link done; screenshots still to add.
4. Owner decides on Gemini billing.
5. **Make the repo public** (`gh repo edit 314cc-star/bluesea-slab-concierge --visibility public --accept-visibility-change-consequences`), only when the owner says so.
6. Owner fills in the Devpost form using `docs/SUBMISSION.md`, adds the sandbox buyer login and the owner key in
   the testing instructions (these go in the form only, never in the repo), ticks the AG Grid and Render prizes,
   and submits.

## Conventions
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commits use the GitHub noreply identity of `314cc-star`.
- Check that no `.env`, `.mcp.json`, `data/orders.json` or `node_modules` is staged before committing.
