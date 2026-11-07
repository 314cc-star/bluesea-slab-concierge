# Devpost submission draft

## Project name
Blue Sea Wood Slab Concierge

## Tagline (one line)
An AI shop assistant that finds the right one-of-a-kind wood slab for your room and reserves it with a PayPal deposit.

## Inspiration
We make solid wood slab tables in Phrae, Thailand. Every slab is unique, so every sale today is a long LINE chat:
the customer sends a size, we walk the yard, send photos one by one, quote a price and ask for a 50% deposit by bank
transfer. We have 7,000+ customer reviews, but this back-and-forth only happens in working hours, and it
is hard for foreign customers living in Thailand. We wanted a shop that does that conversation for us, 24/7,
and takes the deposit safely.

## What it does
- **Slab Concierge (agentic commerce):** customers describe their room. A Gemini agent calls `search_slabs` on live stock, explains which slabs fit and why, and calls `start_checkout` to put a PayPal deposit button in the chat. The customer always approves the payment.
- **PayPal deposit:** 50% is paid through the PayPal JavaScript SDK (wallet or card). The server creates and captures the Orders v2 payment, reserves the slab, and saves the order.
- **Owner desk (AG Grid):** an orders grid with a one-click **PayPal invoice for the balance**, and an editable stock grid that updates the shop and the agent instantly.
- **Any AI assistant can shop here (MCP):** our store is an MCP server. Claude, ChatGPT or any agent can search slabs and create a PayPal deposit link that their human approves. It is agentic commerce with a person in control of the money.
- **See it in your room:** upload a room photo and Gemini image editing shows the real slab as a table in that room.
- **Photo to listing:** the owner snaps a slab on their phone. Gemini vision writes the title, description and Instagram hashtags, and the slab goes live with its real photo.

## How we built it
React + Vite front end, Node/Express API, deployed on Render.
- **PayPal:** JavaScript SDK (`@paypal/react-paypal-js`), Orders v2 create/capture, Invoicing v2 create/send, all in the sandbox. The deposit amount is computed on the server from stored stock, never trusted from the browser.
- **AI:** Google Gemini API, using function calling for the agent and vision with a JSON response schema for listings. Gemini Flash-Lite keeps replies to about 5 seconds, with automatic fallback across Gemini models.
- **AG Grid Community** for the owner dashboard.

## Challenges we ran into
- Keeping the agent honest: it must search real stock before recommending anything, and can only check out slabs that are still available.
- Free-tier AI limits and overloads: we added model fallback with cooldowns based on Google's retry hints.
- Language: many of our customers are foreigners, so the agent pins its reply language to the customer's latest message.

## Accomplishments we're proud of
A real small business flow, end to end: chat, recommendation, PayPal deposit, reservation, balance invoice, and new stock from a phone photo.

## What we learned
Agentic commerce works best when the agent can find and propose, but payment stays a clear human approval.

## What's next
Real stock and photos for every slab, a LINE integration, shipping quotes for slabs over 2 m, and table legs as add-ons in the same checkout.

## Built with
react, vite, node.js, express, paypal-javascript-sdk, paypal-orders-api, paypal-invoicing-api, google-gemini, ag-grid, render

## Testing instructions (paste into the form)
Live demo: <Render URL>. Owner desk: <Render URL>/owner, owner key: <ADMIN_KEY>.
1. Ask the concierge: "A dining table for 6 people, my room is 3 m wide", then "I'll take BSW-2403".
2. Click "Pay deposit with PayPal" and pay with any PayPal sandbox personal account. No real money is used.
3. Open /owner to see the order, then click "Send balance invoice".
4. In "Add a slab with AI", upload a wood slab photo, enter a size and price, and click "Write listing with AI".
Note: the free Render plan sleeps when idle, so the first load can take about a minute.

---

# Demo video script (target 2:45, hard limit 3:00)

Record the screen at 1080p. Add the narration as a voice-over in English, or speak in Thai and add English subtitles (the rules require English or an English translation). Use no copyrighted music; YouTube Audio Library tracks are safe.

| Time | On screen | Narration (English) |
|---|---|---|
| 0:00-0:15 | Real workshop or slab yard footage (phone video), then the shop home page | "I'm the owner of Blue Sea Wood. We make solid wood slab tables in Phrae, Thailand. Every slab is one of a kind, and that makes selling them slow." |
| 0:15-0:30 | A LINE chat on the phone: size, photos, price, bank slip | "Today every order is a long chat: customers send a size, we send photos one by one, quote, and ask for a deposit by bank transfer." |
| 0:30-1:15 | Concierge: type "A dining table for 6 people, my room is 3 m wide". Show the answer and the slab chips, then ask for steel legs and a durable finish. | "So we built Slab Concierge. The customer describes their room. A Gemini agent searches our real stock, not a script, explains which slab fits and why, and suggests legs and a finish." |
| 1:15-1:50 | "I'll take BSW-2403" opens the PayPal button in chat. Pay with the sandbox account. The success message appears and the slab card shows Reserved. | "When they choose, the agent opens a PayPal checkout for the 50% deposit. The customer approves it, never the AI. The slab is reserved instantly." |
| 1:50-2:15 | /owner: the order appears in the AG Grid. Click "Send balance invoice" and show the toast. Edit a price in the stock grid. | "On the owner desk, built with AG Grid, I see the order. When the table is finished, one click sends the balance as a PayPal invoice." |
| (optional, replace part of 1:15-1:50) | Claude Code or Claude Desktop with the shop added as an MCP server: "Find me a 2 m Suar dining slab from Blue Sea Wood and reserve it". The assistant returns a PayPal link; open it and approve. | "And customers don't even need our website. Any AI assistant can shop Blue Sea Wood through our MCP server, but the human always approves the payment on PayPal." |
| 2:15-2:40 | Add a slab with AI: take a phone photo, fill the size, click "Write listing". Show the listing copy, then "Add to shop stock". | "New slab in the yard? I take one photo. Gemini writes the listing for our site, marketplaces and Instagram, and it's live." |
| 2:40-2:50 | Logo + URL | "Blue Sea Wood Slab Concierge: one-of-a-kind wood, sold the way it deserves. Built with PayPal and Gemini." |
