# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Start with nodemon (auto-reload on changes)
npm start       # Start in production mode
```

No test or lint scripts are configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in values:

```
PORT, NODE_ENV, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
JWT_SECRET, JWT_EXPIRES_IN (default: 8h)
FRONTEND_URL    # CORS origin
```

Requires Node.js 18.x+ and a MySQL database.

## Architecture

REST API for a support ticket system. Layered structure: **routes → controllers → services**, with shared middleware and a config-layer DB pool.

```
src/
├── app.js                      # Express setup, global middleware, route registration
├── config/db.js                # MySQL connection pool (mysql2/promise, max 10)
├── middlewares/
│   ├── auth.js                 # JWT verification + role-based authorization
│   └── error.js                # express-validator error handler + global error handler
├── controllers/                # Business logic + response formatting
├── routes/                     # Endpoint definitions + input validation rules
└── services/asignacion.service.js  # Agent auto-assignment (round-robin by fewest open tickets)
```

### Key Concepts

**Roles:** `admin`, `agente`, `cliente` — control access and what data is returned from shared endpoints.

**Ticket creation flow:** Client creates ticket → `asignacion.service.js` finds the agent with the fewest active tickets → ticket is inserted with that agent assigned automatically.

**Role-based data filtering:** The same `GET /api/tickets` endpoint returns different rows depending on the caller's role (admin sees all, agent sees assigned, client sees own).

**Internal comments:** Comments have an `es_interno` flag. Agents/admins can see internal comments; clients cannot.

**Database schema:** Uses dimensional naming — `dim_usuario`, `dim_departamento`, `dim_categoria`, `dim_estado`, `dim_prioridad`, `fact_ticket`, `fact_comentario`, `dim_rol`.

### Auth Pattern

JWT Bearer token. Payload: `{ id_usuario, email, rol, id_departamento }`. Middleware in `auth.js` exports `verificarToken` and `autorizar(...roles)` — routes apply both in sequence.

### Response Format

All responses use `{ ok: true/false, ... }`. Validation errors → 422 with field details. Centralized error handler in `error.js` catches everything else.

### API Modules

| Prefix | Module |
|---|---|
| `/api/auth` | Login, current user |
| `/api/tickets` | Ticket CRUD + comments |
| `/api/usuarios` | User management (admin) |
| `/api/catalogos` | Reference data (departments, categories, states, priorities) |
| `/api/reportes` | Dashboard summary + agent performance |
| `/api/health` | Public health check |

Full API specification is in [CONTEXTO_API.md](CONTEXTO_API.md).
