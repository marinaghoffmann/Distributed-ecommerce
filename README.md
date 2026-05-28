# Distributed-ecommerce

Sistema de e-commerce distribuído construído com microsserviços independentes, replicação de dados, detecção de falhas por heartbeat e autenticação via JWT.

Projeto acadêmico desenvolvido para a disciplina de Sistemas Distribuídos — Cesar School.

---

## Arquitetura

```
Cliente
│
┌─────────▼──────────┐
│    API Gateway     │  :3000
└──┬──────┬──────┬───┘
   │      │      │
┌──▼───┐ ┌▼────┐ ┌▼──────┐
│Users │ │Prod │ │Orders │
│:5001 │ │:5002│ │:5003  │
└──────┘ └──┬──┘ └───────┘
            │
        ┌───▼────┐
        │Replica │
        │:5012   │
        └────────┘
```

## Serviços

| Serviço          | Porta | Responsabilidade                        |
|------------------|-------|-----------------------------------------|
| API Gateway      | 3000  | Roteamento, heartbeat, CORS             |
| Users            | 5001  | Registro, login, autenticação JWT       |
| Products         | 5002  | CRUD de produtos, consistência forte    |
| Products Replica | 5012  | Réplica síncrona do serviço de produtos |
| Orders           | 5003  | Criação e consulta de pedidos           |

## Funcionalidades

- Autenticação JWT com roles (`user` / `admin`)
- Senhas armazenadas com hash bcrypt
- Replicação síncrona de produtos (consistência forte)
- Heartbeat a cada 5s com log de falhas e recuperações
- Retorno 503 automático para serviços indisponíveis
- Dashboard HTML de monitoramento em tempo real
- Docker Compose para subir toda a infraestrutura

## Como rodar

Veja o [README_execucao.md](./README_execucao.md) para instruções detalhadas.

```bash
docker-compose up --build
```

## Tecnologias

- Node.js + Express
- JSON Web Token (JWT)
- bcrypt
- Docker + Docker Compose