require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const IS_REPLICA = process.argv.includes('--replica');
const PORT = IS_REPLICA
  ? (process.env.REPLICA_PORT || 5012)
  : (process.env.PORT || 5002);

const DB_PATH = IS_REPLICA
  ? path.join(__dirname, '../data/products_replica.json')
  : path.join(__dirname, '../data/products.json');

  const REPLICA_URL = process.env.REPLICA_URL || `http://localhost:${process.env.REPLICA_PORT || 5012}`;

let rrIndex = 0;

function readDB() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requer perfil admin' });
  next();
}

app.get('/health', (req, res) =>
  res.json({ status: 'ok', instance: IS_REPLICA ? 'replica' : 'primary' })
);

app.get('/products', async (req, res) => {
  if (!IS_REPLICA) {
    rrIndex++;
    if (rrIndex % 2 === 0) {
      try {
        const r = await fetch(`${REPLICA_URL}/products`);
        const data = await r.json();
        return res.json(data);
      } catch {
      }
    }
  }
  res.json(readDB());
});

app.get('/products/:id', async (req, res) => {
  if (!IS_REPLICA) {
    rrIndex++;
    if (rrIndex % 2 === 0) {
      try {
        const r = await fetch(`${REPLICA_URL}/products/${req.params.id}`);
        if (r.ok) return res.json(await r.json());
      } catch {}
    }
  }
  const product = readDB().find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(product);
});

app.post('/products', authenticate, requireAdmin, async (req, res) => {
  const { name, description, price, stock } = req.body;
  if (!name || price === undefined)
    return res.status(400).json({ error: 'Campos obrigatórios: name, price' });

  const product = { id: uuidv4(), name, description, price, stock: stock ?? 0, createdAt: new Date().toISOString() };
  const products = readDB();
  products.push(product);

  if (!IS_REPLICA) {
    try {
      await fetch(`${REPLICA_URL}/products/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
    } catch {
      return res.status(503).json({ error: 'Réplica indisponível, escrita abortada' });
    }
    writeDB(products);
    return res.status(201).json(product);
  }
  res.status(403).json({ error: 'Escreva no primário' });
});

app.post('/products/replicate', (req, res) => {
  const product = req.body;
  const products = readDB();
  products.push(product);
  writeDB(products);
  res.status(201).json({ ok: true });
});

app.listen(PORT, () =>
  console.log(`[products][${IS_REPLICA ? 'replica' : 'primary'}] porta ${PORT}`)
);