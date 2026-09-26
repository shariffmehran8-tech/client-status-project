// generate-seed.js — run once to produce data.json with dates relative to "today"
const fs = require("fs");
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (t) => new Date(t).toISOString();
const daysAgo = (n) => iso(now - n * DAY);

function client(id, name, since, builder) {
  const signals = { payments: [], responses: [], scopeEvents: [], sentiment: [] };
  builder(signals);
  return { id, name, since, weights: null, signals };
}

const clients = [
  client("c_aurora", "Aurora Robotics", "2023-11-02", (s) => {
    for (let i = 100; i >= 0; i -= 14) {
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - 1) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 2 + Math.random() * 2 });
      s.sentiment.push({ date: daysAgo(i), score: 0.5 + Math.random() * 0.3 });
    }
    s.scopeEvents.push({ date: daysAgo(45), type: "expansion", magnitude: 1 });
  }),

  client("c_northwind", "Northwind Logistics", "2024-02-14", (s) => {
    let lateness = 0;
    for (let i = 100; i >= 0; i -= 12) {
      lateness += 0.6;
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - lateness) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 4 + (100 - i) * 0.08 });
      s.sentiment.push({ date: daysAgo(i), score: 0.3 - (100 - i) * 0.006 });
    }
    s.scopeEvents.push({ date: daysAgo(60), type: "reduction", magnitude: 1 });
    s.scopeEvents.push({ date: daysAgo(20), type: "reduction", magnitude: 1 });
  }),

  client("c_baymark", "Baymark Retail Group", "2023-06-01", (s) => {
    for (let i = 90; i >= 0; i -= 15) {
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - 9) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 18 + Math.random() * 10 });
      s.sentiment.push({ date: daysAgo(i), score: -0.4 - Math.random() * 0.3 });
    }
    s.scopeEvents.push({ date: daysAgo(70), type: "reduction", magnitude: 2 });
    s.scopeEvents.push({ date: daysAgo(30), type: "reduction", magnitude: 1 });
  }),

  client("c_fernleaf", "Fernleaf Studio", daysAgo(18).slice(0, 10), (s) => {
    s.payments.push({ invoiceDate: daysAgo(15), dueDate: daysAgo(10), paidDate: daysAgo(10) });
    s.responses.push({ date: daysAgo(12), hoursToReply: 3 });
    s.sentiment.push({ date: daysAgo(8), score: 0.6 });
  }),

  client("c_solace", "Solace Health Partners", "2023-09-20", (s) => {
    for (let i = 100; i >= 55; i -= 15) {
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - 8) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 14 });
      s.sentiment.push({ date: daysAgo(i), score: -0.2 });
    }
    for (let i = 40; i >= 0; i -= 10) {
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - 0.5) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 3 });
      s.sentiment.push({ date: daysAgo(i), score: 0.4 });
    }
    s.scopeEvents.push({ date: daysAgo(25), type: "expansion", magnitude: 1 });
  }),

  client("c_ridgeline", "Ridgeline Analytics", "2024-05-10", (s) => {
    for (let i = 90; i >= 0; i -= 14) {
      s.payments.push({ invoiceDate: daysAgo(i + 5), dueDate: daysAgo(i), paidDate: daysAgo(i - 2) });
      s.responses.push({ date: daysAgo(i), hoursToReply: 7 });
      s.sentiment.push({ date: daysAgo(i), score: 0.1 });
    }
  }),
];

fs.writeFileSync("data.json", JSON.stringify({ clients }, null, 2));
console.log("Seed data.json written with", clients.length, "clients");
