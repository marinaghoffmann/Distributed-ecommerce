require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const SERVICES = {
  users:    { url: process.env.USERS_URL    || 'http://localhost:5001', status: true, failures: 0 },
  products: { url: process.env.PRODUCTS_URL || 'http://localhost:5002', status: true, failures: 0 },
  orders:   { url: process.env.ORDERS_URL   || 'http://localhost:5003', status: true, failures: 0 },
};

const LOG_PATH = path.join(__dirname, '../logs/heartbeat.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, line + '\n');
}

// --- heartbeat ---
async function checkService(name, svc) {
  try {
    const res = await fetch(`${svc.url}/health`, { timeout: 2000 });
    if (res.ok) {
      if (!svc.status) log(`[RECOVERY] ${name} voltou a responder`);
      svc.status = true;
      svc.failures = 0;
    } else throw new Error(`status ${res.status}`);
  } catch (err) {
    svc.failures++;
    if (svc.failures >= 2 && svc.status) {
      svc.status = false;
      log(`[FAILURE] ${name} não responde (${err.message})`);
    }
  }
}

function startHeartbeat() {
  const interval = parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 5000;
  setInterval(() => {
    for (const [name, svc] of Object.entries(SERVICES)) checkService(name, svc);
  }, interval);
  log('[GATEWAY] Heartbeat iniciado');
}

// --- middleware de health guard ---
function guard(serviceName) {
  return (req, res, next) => {
    if (!SERVICES[serviceName].status)
      return res.status(503).json({ error: `Serviço '${serviceName}' indisponível no momento` });
    next();
  };
}

// --- proxy com repasse de Authorization ---
function proxy(serviceName) {
  const svc = SERVICES[serviceName];
  return createProxyMiddleware({
    target: svc.url,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        res.status(502).json({ error: 'Erro de comunicação com o serviço interno' });
      }
    }
  });
}

// --- rotas ---
app.get('/health', (req, res) => {
  const status = {};
  for (const [k, v] of Object.entries(SERVICES)) status[k] = v.status ? 'up' : 'down';
  res.json({ gateway: 'ok', services: status });
});

app.use('/users',    guard('users'),    proxy('users'));
app.use('/products', guard('products'), proxy('products'));
app.use('/orders',   guard('orders'),   proxy('orders'));

startHeartbeat();

app.listen(process.env.PORT || 3000, () =>
  console.log(`[gateway] rodando na porta ${process.env.PORT || 3000}`)
);