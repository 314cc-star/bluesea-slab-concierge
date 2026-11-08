# Blue Sea Wood · Slab Concierge

**Sell one-of-a-kind, made-to-order goods online: AI finds the real piece, PayPal reserves it.**

> Online shops are built for products you can make a thousand of. We sell things that exist only once, and are finished to order.

Blue Sea Wood is a family wood-slab maker in Phrae, Thailand, with 7,000+ customer reviews. Every slab is a single,
unique piece of Suar (Monkey Pod) wood, and every table is finished to order. Ordinary e-commerce assumes the opposite:

| A normal online shop | Blue Sea Wood |
|---|---|
| One product, 100 identical units in stock | Every slab is unique: stock of exactly one |
| A catalogue photo is enough | Customers need to see *the* slab they will get |
| Pay in full at checkout | Deposit to reserve → made to order → balance before shipping |
| Fixed price | Price depends on legs and finish |
| Selling twice is fine | Selling the same slab twice is a disaster |

So today every sale moves into a LINE chat. The owner sends photos one by one, quotes by hand, waits for a bank slip, and has to make sure the same slab is never promised to two people.

Slab Concierge turns that chat into a self-serve shop built for unique, customised goods:

1. **Find the real piece.** The customer describes their room ("a dining table for 6, my room is 3 m wide"). A Gemini agent searches the **actual slabs in the yard**, never invents stock, and explains why each one fits.
2. **Make it theirs.** The customer chooses legs (steel, wood or none) and one of five finishes, and sees the full price at once.
3. **Reserve it with PayPal.** A 50% deposit **locks that one slab to that one customer** the moment it is captured. The agent can open the checkout, but only the customer approves the payment.
4. **Change of mind? 3 days, full refund.** The owner refunds through PayPal with one click, and the slab goes straight back on sale.
5. **Made to order, then the balance.** After production, one click sends the balance as a PayPal invoice. Delivery is free.
6. **New stock from a photo.** The owner photographs a slab, and the AI writes the listing.
7. **Ready for AI shoppers.** The store is also an **MCP server** (`/mcp`), so any AI assistant can find a slab and hand its user a PayPal approval link.

Built for wood slabs, the pattern fits any maker of one-of-a-kind goods: custom furniture, ceramics, art, vintage, handmade jewellery.

| Live demo | Demo video |
|---|---|
| [bluesea-slab-concierge.onrender.com](https://bluesea-slab-concierge.onrender.com) | [youtu.be/EsnNLFuDd98](https://youtu.be/EsnNLFuDd98) |

---

## How PayPal is used

All PayPal calls run against the **PayPal sandbox**.

| Step | PayPal API | Where |
|---|---|---|
| Deposit checkout (PayPal wallet or card) | **JavaScript SDK** buttons via `@paypal/react-paypal-js` | `client/App.jsx` |
| Create the deposit order; amount is computed on the server from stored stock, never sent by the browser | **Orders v2** `POST /v2/checkout/orders` | `server/paypal.js` |
| Capture the payment, then mark the slab reserved and save the order | **Orders v2** `POST /v2/checkout/orders/{id}/capture` | `server/index.js` |
| Bill the remaining 50% before shipping | **Invoicing v2** create + send invoice | `server/paypal.js` |
| 3-day change-of-mind policy: refund the deposit in full, and the slab goes back on sale | **Payments v2** `POST /v2/payments/captures/{id}/refund` | `server/paypal.js`, Owner desk |
| Checkout link for outside AI agents: Orders v2 with `experience_context` return/cancel URLs; the user approves via the `payer-action` link | **Orders v2** + redirect flow | `server/mcp.js`, `client/CheckoutReturn.jsx` |

## Agentic commerce: shop by MCP

`POST /mcp` is a stateless MCP server (Streamable HTTP, `@modelcontextprotocol/sdk`). It has four tools:

| Tool | What it does |
|---|---|
| `search_slabs` | Filters live stock by size, edge style and budget. Returns photos, prices and the deposit for each slab. |
| `get_slab` | Gets one slab's full details and current availability. |
| `create_deposit_checkout` | Creates a PayPal order for the deposit and returns `checkout_url` for the human to approve. |
| `check_checkout` | Confirms payment. If the user approved but never returned to the site, it captures the deposit and reserves the slab. |

The agent can never pay on its own: money only moves after a person approves on PayPal.
To add it to Claude Code, run:

```bash
claude mcp add --transport http blue-sea-wood https://<your-render-url>/mcp
```

## How AI is used

**Google Gemini API** (default `gemini-3.1-flash-lite`, with automatic fallback to other Gemini models when one is busy or out of quota).

- **Agentic shop assistant** (`server/concierge.js`): Gemini function calling with two tools:
  - `search_slabs`: filters live stock by length, width, edge style and budget.
  - `start_checkout`: puts a PayPal deposit button in the chat for one slab.

  The system prompt carries the shop's real policies: price list, legs and finishes, a 50% deposit, about 14 days of production, free delivery, a 3-day full refund before production starts, bow-tie crack repair and a lifetime repair warranty. The agent must call `search_slabs` before it recommends anything. It also suggests legs and a finish, and `start_checkout` carries those choices into the checkout.
- **See it in your room** (`server/visualize.js`): Gemini image editing (Nano Banana) puts the chosen slab into the customer's room photo. When the slab has a real photo, that photo is used as the reference. Each visitor gets a limited number of previews per hour, with a daily cap for the whole site.
- **Photo-to-listing writer** (`server/listing.js`): Gemini vision reads a slab photo plus the owner's measurements and returns structured JSON (`responseSchema`). That JSON holds the shop-card text, a marketplace title and description, and Instagram hashtags.

## Findable by search engines and AI assistants

People already ask AI assistants things like *"where can I buy a 2.5 m live-edge dining slab in Thailand?"*. So the live stock is published in forms machines read (`server/seo.js`):

- **schema.org JSON-LD** in every page: a `FurnitureStore` plus one `Product` per slab, with size, photo, price in THB and in-stock or sold status. The server builds it from live stock on each request, so a reserved slab shows as sold right away.
- **A plain-HTML stock list** in `<noscript>` for crawlers that don't run JavaScript.
- **`/llms.txt`**: a live Markdown summary for AI assistants. It covers how to buy, the slabs in stock, the MCP endpoint and contact details.
- **`/robots.txt`**: allows crawling, keeps `/owner` out, and points to `llms.txt`.

## Sponsor tools

- **AG Grid** (`client/Dashboard.jsx`): the Owner desk shows two grids.
  - **Orders grid**: deposits, balances and status, with a "Send balance invoice" action in each row.
  - **Editable stock grid**: change price, tone or status inline, and the change goes live in the shop and in the AI agent at once.
- **Render**: deployed as a single Node web service (`render.yaml`).

## Try it (judges)

1. Open the live demo and ask the concierge, for example: *"A dining table for 6 people, my room is 3 m wide"*, then choose an available slab, such as *"I'll take BSW-177"*.
2. Click **Pay deposit with PayPal** and pay with a **PayPal sandbox personal account** (developer.paypal.com > Testing Tools > Sandbox Accounts). No real money moves. Demo reservations are released after 30 minutes; the intended customer refund window is 3 days.
3. Open **/owner** (owner key: _given in the Devpost submission_). The order shows in the Orders grid. Click **Send balance invoice**.
4. In **Add a slab with AI**, upload any wood slab photo, enter a size and price, and click **Write listing with AI**.

## Run locally

Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env   # add PayPal sandbox keys and a Gemini API key
npm run dev            # shop on http://localhost:5173, owner desk on /owner
```

Production: `npm run build && npm start` (serves the built site and API from one port).

## Project layout

```
server/index.js      Express API: stock, PayPal orders, owner routes
server/paypal.js     PayPal Orders v2 + Invoicing v2 client
server/concierge.js  Gemini agent with function calling and model fallback
server/listing.js    Gemini vision listing writer
server/store.js      JSON-file store (data/slabs.json, data/orders.json)
client/App.jsx       Shop, slab cards, PayPal deposit dialog
client/Concierge.jsx Chat UI
client/Dashboard.jsx Owner desk (AG Grid)
client/ListingWriter.jsx Photo-to-listing panel
```

## Honest limits

- Stock shown in the demo is sample data built from Blue Sea Wood's real 2026 price list; photos are added through the Owner desk.
- Data is kept in JSON files. On Render's free plan, the disk resets on each redeploy, so the demo starts fresh.
- The Gemini free tier has small daily limits; the app falls back between models, and a paid key removes the limit.

## License

The code is MIT licensed (see `LICENSE`).

The Blue Sea Wood name and logo, and the photos in `client/public/brand` and `data/photos`, are trademarks and images of Blue Sea Wood. They are not covered by the MIT license.
