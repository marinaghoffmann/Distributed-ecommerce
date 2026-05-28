# distributed-ecommerce — Execução

Sistema de e-commerce distribuído com microsserviços, replicação de dados, heartbeat e autenticação JWT.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18+ — para rodar localmente
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — para rodar via Docker

---

## Opção 1 — Docker Compose (recomendado)

Sobe toda a infraestrutura com um único comando:

```bash
docker-compose up --build
```

Isso inicia 5 containers:

| Container         | Porta | Descrição                        |
|-------------------|-------|----------------------------------|
| gateway           | 3000  | API Gateway com heartbeat        |
| users             | 5001  | Serviço de usuários + JWT        |
| products          | 5002  | Serviço de produtos (primário)   |
| products-replica  | 5012  | Réplica do serviço de produtos   |
| orders            | 5003  | Serviço de pedidos               |

Para parar:

```bash
docker-compose down
```

---

## Opção 2 — Execução local (sem Docker)

### 1. Instalar dependências

```bash
cd users    && npm install && cd ..
cd products && npm install && cd ..
cd orders   && npm install && cd ..
cd gateway  && npm install && cd ..
```

### 2. Subir os serviços (6 terminais separados)

```bash
# Terminal 1
cd users && npm start

# Terminal 2
cd products && npm start

# Terminal 3
cd products && node src/index.js --replica

# Terminal 4
cd orders && npm start

# Terminal 5
cd gateway && npm start
```

### 3. Abrir o dashboard

Abra o arquivo `dashboard/index.html` diretamente no navegador:

```bash
open dashboard/index.html
```

---

## Testando a API

### Verificar saúde dos serviços

```bash
curl http://localhost:3000/health
```

### Registrar usuário admin

```bash
curl -X POST http://localhost:3000/users/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Marina","email":"marina@teste.com","password":"123456","role":"admin"}'
```

### Login e obtenção do token JWT

```bash
curl -X POST http://localhost:3000/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marina@teste.com","password":"123456"}'
```

Copie o valor do campo `token` da resposta para usar nos próximos comandos.

### Criar produto (requer token de admin)

```bash
curl -X POST http://localhost:3000/products \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -d '{"name":"Notebook","description":"Intel i7","price":3500,"stock":10}'
```

### Listar produtos

```bash
curl http://localhost:3000/products
```

### Criar pedido (requer token)

```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -d '{"productId":"ID_DO_PRODUTO","quantity":2}'
```

### Listar pedidos do usuário

```bash
curl http://localhost:3000/orders/SEU_USER_ID \
  -H 'Authorization: Bearer SEU_TOKEN'
```

---

## Testando o heartbeat

Para simular falha de um serviço, pare um dos containers:

```bash
docker-compose stop orders
```

Aguarde ~10 segundos e observe o terminal do gateway registrar a falha. Para restaurar:

```bash
docker-compose start orders
```

O gateway registrará a recuperação automaticamente.

---

## Estrutura do projeto

```
distributed-ecommerce/
├── gateway/          ← API Gateway com heartbeat e proxy
├── users/            ← Serviço de usuários (registro, login, JWT)
├── products/         ← Serviço de produtos com replicação
├── orders/           ← Serviço de pedidos
├── dashboard/        ← Dashboard HTML de monitoramento
├── docker-compose.yml
├── README_execucao.md
└── relatorio.pdf
```

---

## Variáveis de ambiente

Cada serviço possui um arquivo `.env`. Em produção, substitua os valores padrão:

| Variável         | Descrição                        | Padrão                          |
|------------------|----------------------------------|---------------------------------|
| `JWT_SECRET`     | Chave de assinatura dos tokens   | `super_secret_key_change_in_prod` |
| `PORT`           | Porta do serviço                 | varia por serviço               |
| `REPLICA_URL`    | URL da réplica de produtos       | `http://localhost:5012`         |