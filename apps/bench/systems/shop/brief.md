# A note from the client

From: Marta Wolska, owner of Zielony Kubek

Hi,

we sell mugs, teapots and tea accessories online. Today orders come in by
e-mail, Kasia in the warehouse keeps stock in a spreadsheet, and I send
payment links by hand. Twice last month we sold something we no longer had,
and once we shipped an order nobody had paid for. I want this in a proper
system before the season starts. We sell across the EU and all our prices
are in euro.

What I have in mind: our products with prices, knowing what we have in the
warehouse, taking customers' orders, card payments through PayLine (their
documentation is below), and sending paid orders out.

There is no web shop yet. An agency will build it later on top of whatever
you make, so for now I need the back end with an API they can use.

I have not thought everything through. Kasia runs the warehouse and Tomek
does the books; both have opinions. Ask.

Marta

## PayLine (payment provider)

```
POST {PAYMENT_PROVIDER_URL}/charges
{ "amountCents": 1999, "reference": "…" }

201 { "chargeId": "ch_…", "status": "succeeded" | "declined" }
```

PayLine can also fail with a 5xx answer.

## From our hosting company

- TypeScript on Node.js 20, SQLite for storage.
- `npm install`, then `npm run build`, then `npm start` starts the server.
- Configuration from the environment: `PORT`, `DATABASE_PATH` (the SQLite
  file; created when missing), `PAYMENT_PROVIDER_URL`.
- `GET /health` answers 200 once the server is ready.
- The API is JSON over HTTP, on an internal network: no login for now.
- `docs/openapi.yaml` documents the whole API and is kept current. The
  agency and our testers work from that file alone, without the code.
- Anything that depends on time passing (deadlines, clean-up jobs) is
  started by our scheduler through an HTTP call, and that call must accept
  the time to assume as a parameter. Our test environment relies on it.
- The project's own tests run with `npm test`.
