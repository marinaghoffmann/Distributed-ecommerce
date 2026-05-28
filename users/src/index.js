require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, '../data/users.json');

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
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/users/register', async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, password' });

  const users = readDB();
  if (users.find(u => u.email === email))
    return res.status(409).json({ error: 'Email já cadastrado' });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), name, email, password: hash, role, createdAt: new Date().toISOString() };
  users.push(user);
  writeDB(users);

  const { password: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

app.post('/users/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readDB();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/users/:id', authenticate, (req, res) => {
  if (req.user.userId !== req.params.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Acesso negado' });

  const user = readDB().find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`[users] rodando na porta ${PORT}`));