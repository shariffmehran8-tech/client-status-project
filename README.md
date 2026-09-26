# Client Vitals — Relationship Health Score

Standalone tool that scores each client's relationship health (0–100) from four
signals: payment timeliness, response speed, scope stability, and sentiment.
Diagnostic, not predictive — tells you how things stand right now, not just
whether a client will churn.

## Stack
- Backend: Node/Express, flat `data.json` storage (no DB)
- Frontend: CDN React (no build step), served as a static file by Express
- Port: `4020`

## Setup
```
npm install
npm run seed   # (re)generates data.json with fresh demo data, dates relative to today
npm start
```
Open `http://localhost:4020`.

## API
- `GET  /api/clients` — all clients with score, sub-scores, trajectory, alerts
- `GET  /api/clients/:id` — single client, includes raw signal history
- `POST /api/clients` — create a client `{ name, since }`
- `POST /api/clients/:id/signals` — add a signal event
  `{ type: "payment" | "response" | "scope" | "sentiment", ...fields }`
- `POST /api/clients/:id/weights` — override a client's scoring weights
  (`null` resets to default)

## Scoring
Default weights: payment 30%, responsiveness 20%, scope stability 20%, sentiment 30%.
Missing signals in a window are excluded rather than counted as 0, so a new
client with no payment history yet isn't penalized for it.

Tune the curves/weights in `healthScore.js`.

## Files
- `healthScore.js` — scoring engine (sub-scores, composite, trajectory, alerts)
- `server.js` — Express API
- `generate-seed.js` — demo data generator
- `public/index.html` — frontend
