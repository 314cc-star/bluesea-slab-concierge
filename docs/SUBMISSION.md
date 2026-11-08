# Devpost submission draft

## Project name
Blue Sea Wood Slab Concierge

## Tagline (one line)
Sell one-of-a-kind, made-to-order goods online: AI finds the real piece, PayPal reserves it.

## Inspiration
We make solid wood slab tables in Phrae, Thailand, and have 7,000+ customer reviews. Every slab we sell exists only
once, and every table is finished to order with the customer's legs and finish.

Online shops are built for the opposite: identical products, a catalogue photo, pay in full, sell as many as you like.
None of that works for us. So every sale moves into a chat, and I chat with many customers at the same time. Often
several of them want the same slab: one asks if it is still available, one asks me to hold it until tomorrow, one sends
a transfer slip. Who gets it? Did I already promise it to someone? It is slow, it causes arguments, and it stops when
we sleep.

We wanted one simple, fair rule: **whoever pays the deposit first gets the slab.** A 50% PayPal deposit reserves that
one slab for that one customer for 3 days, the website marks it Reserved so nobody else can pay for it, and if they
change their mind within 3 days the deposit is refunded and the slab goes back on sale.

In this sandbox demo, test reservations are released automatically after 30 minutes so judges can try the same slabs. The 3-day period describes the intended customer refund policy.

## What it does
- **Finds the real piece.** Customers describe their room. A Gemini agent calls `search_slabs` on live stock (real slabs, real photos, real measurements) and explains which slab fits and why. It never invents stock or prices.
- **Made to order.** Customers choose steel, wooden or no legs and one of five finishes, and see the total at once. The agent can suggest options, for example a durable polyurethane finish for a family with kids.
- **Reserves one unique item.** A 50% PayPal deposit locks that one slab to that one customer as soon as it is captured. No double-selling.
- **The full made-to-order lifecycle on PayPal:**
  - deposit to reserve (Orders v2)
  - delivery address taken from the PayPal checkout
  - a 3-day change-of-mind window with a one-click full refund (Refunds)
  - a balance invoice before shipping (Invoicing v2)
- **Owner desk on AG Grid.** Orders with phone, delivery address, refund and invoice actions; editable stock that updates the shop and the agent instantly; and a photo-to-listing writer (Gemini vision).
- **Ready for AI shoppers.** The store is an MCP server. Claude, ChatGPT or any agent can find a slab and create a PayPal deposit link, and the human approves the payment on PayPal.
- **Findable by AI search.** Live schema.org product data and an `llms.txt` describe the stock to search engines and AI assistants.

## How we built it
React + Vite front end, Node/Express API, deployed on Render.
- **PayPal:**
  - JavaScript SDK (`@paypal/react-paypal-js`) for wallet and card checkout
  - Orders v2 create and capture, with legs, finish and contact details carried in `custom_id`
  - an Orders v2 redirect flow (`payer-action` link) for checkouts created by AI agents
  - Invoicing v2 create and send
  - Payments v2 capture refunds

  Every amount is computed on the server from stored prices; the browser never sends a price.
- **AI (Google Gemini):**
  - function calling for the shop agent (`search_slabs`, `start_checkout`)
  - vision with a JSON response schema for listings
  - automatic fallback across Gemini models when one is busy
- **MCP:** a stateless Streamable HTTP server (`@modelcontextprotocol/sdk`) with four tools: `search_slabs`, `get_slab`, `create_deposit_checkout` and `check_checkout`.
- **AG Grid Community** for the owner desk; **Render** for hosting.

## Challenges we ran into
- **Uniqueness.** Every slab is stock of one, so a reservation has to be atomic. A capture can arrive twice (page reloads, an agent checking the order), so the capture step is safe to repeat.
- **Keeping the agent honest.** It must search real stock before recommending anything, and can only check out slabs that are still available.
- **Pricing made-to-order goods.** The price depends on the slab, legs and finish. It is quoted live in the browser but always recomputed on the server before PayPal sees it.
- **Free-tier AI limits.** We added model fallback with cooldowns based on Google's retry hints.

## Accomplishments we're proud of
A real small business on real stock, end to end: chat, a recommendation, customisation, a PayPal deposit, a reservation, a refund or a balance invoice, and new stock from a phone photo.

## What we learned
Unique, made-to-order goods need a different checkout, one built around reserving rather than buying. And agentic commerce works best when the agent finds and proposes, while the payment stays a clear human approval.

## What's next
Moving from JSON files to a database, a LINE integration for order updates, PayPal webhooks to mark balances paid automatically, and opening the same flow to other makers of one-of-a-kind goods.

## Links
- Live demo: https://bluesea-slab-concierge.onrender.com
- Demo video: https://youtu.be/EsnNLFuDd98
- Code: https://github.com/314cc-star/bluesea-slab-concierge

## Built with
react, vite, node.js, express, paypal-javascript-sdk, paypal-orders-api, paypal-invoicing-api, paypal-payments-api, google-gemini, model-context-protocol, ag-grid, render

## Testing instructions (paste into the form)
Live demo: https://bluesea-slab-concierge.onrender.com. Owner desk: https://bluesea-slab-concierge.onrender.com/owner, owner key: <ADMIN_KEY>.
PayPal sandbox buyer: <sandbox personal email> / <sandbox password> (sandbox only, no real money).
1. Ask the concierge: "A dining table for 6 people, my room is 3 m wide", then "I'll take BSW-177 with steel legs".
2. Click "Review and pay deposit", enter any phone number, click the yellow PayPal button and log in with the sandbox buyer above.
3. The confirmation shows the order number, the delivery address from PayPal and the timeline.
4. Open /owner to see the order. Click "Send balance invoice" (PayPal Invoicing), or "Refund" (PayPal Refunds) to put the slab back on sale.
5. Optional: add the MCP server `https://bluesea-slab-concierge.onrender.com/mcp` to an AI assistant and ask it to find and reserve a slab.
Note: this demo releases test reservations after 30 minutes. The free Render plan may need about a minute to wake up.

---

# Demo video script (target 2:45, hard limit 3:00)

Record the screen at 1080p. Add the narration as a voice-over in English, or speak in Thai and add English subtitles (the rules require English or an English translation). Use no copyrighted music; YouTube Audio Library tracks are safe.

| Time | On screen | Narration (English) |
|---|---|---|
| 0:00-0:12 | Slab yard footage: the forklift lifting one big slab with chalk numbers | "Every slab I sell exists only once. This one, number 177, is the only one in the world." |
| 0:12-0:30 | Phone: a long LINE chat with photos, a price typed by hand, a bank slip | "Online shops are built for products you can make a thousand of. So every sale moves into a chat: photos one by one, a price by hand, a bank slip, and the fear of selling the same slab twice." |
| 0:30-1:00 | Website: ask "A dining table for 6 people, my room is 3 m wide". Show the answer, the slab chips, and open the photo viewer. | "So we built a shop for one-of-a-kind goods. Our Gemini agent searches the real slabs in our yard, not a catalogue, and explains which one fits your room." |
| 1:00-1:25 | Ask for steel legs and a durable finish; the checkout opens with them chosen. Switch the finish and watch the total update. | "Every table is made to order. Choose the legs and the finish, and the price updates instantly." |
| 1:25-1:55 | Enter a phone number, pay the deposit with the PayPal sandbox account; the confirmation shows the order, address and timeline; the slab card shows Reserved. | "A 50% PayPal deposit reserves this exact slab for you, and nobody else can buy it. PayPal gives us your delivery address, and you have three days to change your mind." |
| 1:55-2:20 | /owner: the order in AG Grid with phone and address. Click Refund on one order (the slab returns to stock), then Send balance invoice on another. | "On my owner desk I see every order. A refund is one click through PayPal, and the slab goes straight back on sale. When a table is finished, one click sends the balance as a PayPal invoice." |
| 2:20-2:38 | An AI assistant connected to our MCP server finds a slab and returns a PayPal link; open it and approve. | "And we're ready for AI shoppers: any assistant can find a slab and hand you a PayPal link, but you always approve the payment." |
| 2:38-2:50 | Logo, URL | "Blue Sea Wood: one-of-a-kind goods, reserved with PayPal. Built for our wood, ready for every maker of things that exist only once." |
