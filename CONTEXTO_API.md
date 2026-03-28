# CONTEXTO API — Sistema de Tickets (Backend)

## Descripción
API REST construida con Node.js + Express que sirve un sistema de tickets de soporte.
Corre en hosting cPanel Chile usando "Setup Node.js App".

---

## Stack
- Node.js + Express
- MySQL2 (pool de conexiones)
- JWT para autenticación
- bcrypt para hash de contraseñas
- express-validator para validaciones

---

## Estructura de archivos

```
src/
├── app.js                          ← entrada, registra rutas y middlewares
├── config/
│   └── db.js                       ← pool MySQL con mysql2/promise
├── middlewares/
│   ├── auth.js                     ← authenticate (JWT) y authorize (roles)
│   └── error.js                    ← validate (express-validator) y errorHandler global
├── controllers/
│   ├── auth.controller.js          ← login, me
│   ├── ticket.controller.js        ← listar, obtener, crear, actualizar, comentar
│   ├── usuario.controller.js       ← listar, obtener, crear, actualizar, cambiarPassword, listarAgentes
│   ├── catalogo.controller.js      ← GET y CRUD de departamentos, categorías, estados, prioridades, roles
│   └── reporte.controller.js       ← resumen (dashboard), agentes (rendimiento)
├── routes/
│   ├── auth.routes.js
│   ├── ticket.routes.js
│   ├── usuario.routes.js
│   ├── catalogo.routes.js
│   └── reporte.routes.js
└── services/
    └── asignacion.service.js       ← asignarAgente() round-robin por carga mínima
```

---

## Variables de entorno (.env)

```
PORT=3000
NODE_ENV=development
DB_HOST=tuhosting.cl
DB_PORT=3306
DB_USER=usuario_mysql
DB_PASSWORD=password_mysql
DB_NAME=nombre_bd
JWT_SECRET=frase_larga_aleatoria
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
```

---

## Base de datos (MySQL)

### Tablas dimensión
```sql
dim_rol          (id_rol, nombre, descripcion, activo)
dim_departamento (id_departamento, nombre, descripcion, activo)
dim_categoria    (id_categoria, id_departamento FK, nombre, descripcion, activo)
dim_estado       (id_estado, nombre, color_hex, orden)
dim_prioridad    (id_prioridad, nombre, color_hex, nivel)
dim_usuario      (id_usuario, id_rol FK, id_departamento FK nullable,
                  nombre, apellido, email, password_hash, activo, created_at)
```

### Tablas fact
```sql
fact_ticket     (id_ticket, id_usuario_creador FK, id_usuario_asignado FK nullable,
                 id_departamento FK, id_categoria FK, id_estado FK, id_prioridad FK,
                 titulo, descripcion, created_at, updated_at, closed_at nullable)

fact_comentario (id_comentario, id_ticket FK, id_usuario FK,
                 contenido, es_interno TINYINT, created_at)
```

### Reglas de negocio en BD
- `dim_usuario.id_departamento` es NULL para clientes, obligatorio para agentes
- `fact_ticket.id_usuario_asignado` es NULL al crear (se asigna automáticamente)
- `fact_ticket.closed_at` se llena cuando el estado cambia a "Resuelto" o "Cerrado"
- `fact_comentario.es_interno = 1` → nota privada, solo visible para admin y agentes

---

## Autenticación

- Todas las rutas (excepto `/api/auth/login` y `/api/health`) requieren JWT
- Header: `Authorization: Bearer <token>`
- El token contiene: `{ id_usuario, email, rol, id_departamento }`
- Middleware `authenticate` → valida token, setea `req.user`
- Middleware `authorize('admin', 'agente')` → valida rol

### Roles disponibles
| Rol | id_rol |
|-----|--------|
| admin | 1 |
| agente | 2 |
| cliente | 3 |

---

## Endpoints completos

### Auth — `/api/auth`
```
POST   /login         público        { email, password } → { ok, token, user }
GET    /me            autenticado    → { ok, user }
```

### Tickets — `/api/tickets`
```
GET    /              autenticado    listar (filtros: estado, prioridad, buscar, pagina, limite)
GET    /:id           autenticado    obtener ticket + comentarios
POST   /              autenticado    crear ticket
PATCH  /:id           admin, agente  actualizar estado / prioridad / reasignar
POST   /:id/comentarios autenticado  agregar comentario
```

#### Visibilidad por rol en GET /tickets y GET /:id
- `cliente` → solo sus propios tickets (`id_usuario_creador = req.user.id_usuario`)
- `agente` → solo tickets de su departamento (`id_departamento = req.user.id_departamento`)
- `admin` → todos sin restricción

#### Body POST /tickets
```json
{
  "id_departamento": 1,
  "id_categoria": 2,
  "id_prioridad": 2,
  "titulo": "string",
  "descripcion": "string"
}
```

#### Body PATCH /tickets/:id
```json
{
  "id_estado": 2,
  "id_prioridad": 3,
  "id_usuario_asignado": 5
}
```
Nota: `id_usuario_asignado` solo lo puede cambiar el admin.

#### Body POST /tickets/:id/comentarios
```json
{
  "contenido": "string",
  "es_interno": false
}
```
Nota: si el autor es cliente, `es_interno` se fuerza a `false` en el backend.

#### Respuesta GET /tickets
```json
{
  "ok": true,
  "total": 42,
  "pagina": 1,
  "limite": 20,
  "tickets": [
    {
      "id_ticket": 1,
      "titulo": "string",
      "estado": "Abierto",
      "estado_color": "#3B82F6",
      "prioridad": "Alta",
      "prioridad_color": "#F59E0B",
      "departamento": "Soporte Técnico",
      "categoria": "Falla de sistema",
      "creador": "Juan Pérez",
      "asignado": "María González",
      "created_at": "2025-01-01T12:00:00",
      "updated_at": "2025-01-01T13:00:00",
      "closed_at": null
    }
  ]
}
```

#### Respuesta GET /tickets/:id
```json
{
  "ok": true,
  "ticket": { ...mismo objeto anterior + todos los campos de fact_ticket },
  "comentarios": [
    {
      "id_comentario": 1,
      "contenido": "string",
      "es_interno": 0,
      "created_at": "...",
      "autor": "María González",
      "rol_autor": "agente"
    }
  ]
}
```

---

### Usuarios — `/api/usuarios`
```
GET    /              admin          listar todos (incluye rol e id_rol, departamento e id_departamento)
GET    /agentes       admin          listar agentes con tickets_activos (query: ?id_departamento=X)
GET    /:id           admin          obtener usuario por id
POST   /              admin          crear usuario
PATCH  /:id           admin          actualizar usuario
PATCH  /:id/password  propio o admin cambiar contraseña
```

#### Body POST /usuarios
```json
{
  "nombre": "string",
  "apellido": "string",
  "email": "string",
  "password": "min 8 chars",
  "id_rol": 2,
  "id_departamento": 1
}
```

#### Body PATCH /usuarios/:id/password
```json
{
  "password_actual": "solo requerido si no es admin",
  "password_nuevo": "min 8 chars"
}
```

---

### Catálogos — `/api/catalogos`

#### Lectura (todos los roles autenticados)
```
GET  /roles
GET  /departamentos
GET  /categorias              query: ?id_departamento=X  (filtra por depto)
GET  /estados
GET  /prioridades
```

#### CRUD (solo admin)
```
POST   /departamentos
PATCH  /departamentos/:id

POST   /categorias             body requiere id_departamento
PATCH  /categorias/:id

POST   /estados
PATCH  /estados/:id

POST   /prioridades
PATCH  /prioridades/:id
```

#### Respuesta GET /catalogos/estados
```json
{
  "ok": true,
  "estados": [
    { "id_estado": 1, "nombre": "Abierto",      "color_hex": "#3B82F6", "orden": 1 },
    { "id_estado": 2, "nombre": "En progreso",  "color_hex": "#F59E0B", "orden": 2 },
    { "id_estado": 3, "nombre": "En espera",    "color_hex": "#8B5CF6", "orden": 3 },
    { "id_estado": 4, "nombre": "Resuelto",     "color_hex": "#10B981", "orden": 4 },
    { "id_estado": 5, "nombre": "Cerrado",      "color_hex": "#6B7280", "orden": 5 }
  ]
}
```

#### Respuesta GET /catalogos/prioridades
```json
{
  "ok": true,
  "prioridades": [
    { "id_prioridad": 1, "nombre": "Baja",    "color_hex": "#6B7280", "nivel": 1 },
    { "id_prioridad": 2, "nombre": "Media",   "color_hex": "#3B82F6", "nivel": 2 },
    { "id_prioridad": 3, "nombre": "Alta",    "color_hex": "#F59E0B", "nivel": 3 },
    { "id_prioridad": 4, "nombre": "Crítica", "color_hex": "#EF4444", "nivel": 4 }
  ]
}
```

---

### Reportes — `/api/reportes`
```
GET  /resumen     admin y agente   métricas del dashboard
GET  /agentes     solo admin       rendimiento por agente
```

#### Respuesta GET /reportes/resumen
```json
{
  "ok": true,
  "resumen": {
    "por_estado": [
      { "estado": "Abierto", "color_hex": "#3B82F6", "total": 12 }
    ],
    "por_prioridad": [
      { "prioridad": "Alta", "color_hex": "#F59E0B", "total": 5 }
    ],
    "por_departamento": [
      { "departamento": "Soporte Técnico", "total": 20 }
    ],
    "tiempo_promedio_hrs": 4.5,
    "ultimos_7_dias": [
      { "fecha": "2025-01-01", "total": 3 }
    ],
    "sin_asignar": 2
  }
}
```
Nota: `por_departamento` solo viene con datos para el rol `admin`. El rol `agente` ve datos filtrados a su departamento.

#### Respuesta GET /reportes/agentes
```json
{
  "ok": true,
  "agentes": [
    {
      "agente": "María González",
      "departamento": "Soporte Técnico",
      "total_asignados": 15,
      "total_resueltos": 12,
      "hrs_promedio": 3.2
    }
  ]
}
```

---

## Formato de respuestas

### Éxito
```json
{ "ok": true, ...datos }
```

### Error de validación (422)
```json
{ "ok": false, "errors": [{ "msg": "...", "path": "campo" }] }
```

### Error general
```json
{ "ok": false, "message": "descripción del error" }
```

### Códigos HTTP usados
| Código | Cuándo |
|--------|--------|
| 200 | GET, PATCH exitoso |
| 201 | POST exitoso (creación) |
| 400 | Petición inválida (nada que actualizar, etc.) |
| 401 | Token inválido, expirado o credenciales incorrectas |
| 403 | Sin permiso para esa acción (rol insuficiente) |
| 404 | Recurso no encontrado |
| 409 | Conflicto (email duplicado, nombre duplicado) |
| 422 | Error de validación de campos |
| 500 | Error interno del servidor |

---

## Lógica de asignación automática

Al crear un ticket (`POST /api/tickets`), el servicio `asignacion.service.js` busca
el agente del departamento seleccionado con menos tickets activos (estados que NO sean
"Resuelto" ni "Cerrado"). Si no hay agentes disponibles, `id_usuario_asignado` queda NULL.

El admin puede reasignar manualmente con:
```
PATCH /api/tickets/:id
{ "id_usuario_asignado": 5 }
```

---

## Credenciales de prueba

```
Email:    admin@123.cl
Password: 12345
Rol:      admin
```

---

## Cómo correr en desarrollo

```bash
npm install
cp .env.example .env    # llenar con credenciales reales
npm run dev             # nodemon — recarga automática
```

Verificar que funciona:
```
GET http://localhost:3000/api/health
→ { "ok": true, "env": "development" }
```
