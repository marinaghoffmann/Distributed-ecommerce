require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, '../data/orders.json');

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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/orders', authenticate, async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId é obrigatório' });

  // valida produto consultando o serviço de produtos
  try {
    const r = await fetch(`${process.env.PRODUCTS_URL}/products/${productId}`);
    if (!r.ok) return res.status(404).json({ error: 'Produto não encontrado' });
    const product = await r.json();

    const order = {
      id: uuidv4(),
      userId: req.user.userId,
      productId,
      productName: product.name,
      productPrice: product.price,
      quantity,
      total: product.price * quantity,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    const orders = readDB();
    orders.push(order);
    writeDB(orders);
    res.status(201).json(order);
  } catch (err) {
    res.status(503).json({ error: 'Serviço de produtos indisponível' });
  }
});

app.get('/orders/:userId', authenticate, (req, res) => {
  if (req.user.userId !== req.params.userId && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Acesso negado' });

  const orders = readDB().filter(o => o.userId === req.params.userId);
  res.json(orders);
});

app.listen(process.env.PORT || 5003, () =>
  console.log(`[orders] rodando na porta ${process.env.PORT || 5003}`)
);