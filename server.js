// server.js
// Standalone client health score API. Flat data.json storage, no database.
// Port 4020 — sits alongside the main dashboard (4000) and forecasting app (4010).

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const {
  DEFAULT_WEIGHTS,
  computeTrajectory,
  classify,
  computeAlerts,
} = require("./healthScore");

const DATA_PATH = path.join(__dirname, "data.json");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}
function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function summarize(client) {
  const trajectory = computeTrajectory(client);
  const latest = trajectory[trajectory.length - 1];
  const alerts = computeAlerts(client, trajectory);
  return {
    id: client.id,
    name: client.name,
    since: client.since,
    score: latest.score,
    status: classify(latest.score),
    subScores: latest.subScores,
    trajectory,
    alerts,
    weights: client.weights || DEFAULT_WEIGHTS,
  };
}

app.get("/api/clients", (req, res) => {
  const data = readData();
  res.json(data.clients.map(summarize));
});

app.get("/api/clients/:id", (req, res) => {
  const data = readData();
  const client = data.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json({ ...summarize(client), signals: client.signals });
});

app.post("/api/clients", (req, res) => {
  const data = readData();
  const { name, since } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const id = "c_" + Date.now().toString(36);
  const client = {
    id,
    name,
    since: since || new Date().toISOString().slice(0, 10),
    weights: null,
    signals: { payments: [], responses: [], scopeEvents: [], sentiment: [] },
  };
  data.clients.push(client);
  writeData(data);
  res.status(201).json(summarize(client));
});

app.post("/api/clients/:id/signals", (req, res) => {
  const data = readData();
  const client = data.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const { type, ...payload } = req.body;
  const map = { payment: "payments", response: "responses", scope: "scopeEvents", sentiment: "sentiment" };
  const key = map[type];
  if (!key) return res.status(400).json({ error: "type must be one of payment, response, scope, sentiment" });

  client.signals[key] = client.signals[key] || [];
  client.signals[key].push(payload);
  writeData(data);
  res.status(201).json(summarize(client));
});

app.post("/api/clients/:id/weights", (req, res) => {
  const data = readData();
  const client = data.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  client.weights = req.body.weights || null;
  writeData(data);
  res.json(summarize(client));
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/favicon.ico", (req, res) => res.status(204).end());

const PORT = process.env.PORT || 4020;
app.listen(PORT, () => console.log(`Client health score API listening on port ${PORT}`));
