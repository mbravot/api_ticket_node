# Ticket Backend — API REST

## Instalación local

```bash
cd ticket-backend
npm install
cp .env.example .env   # Edita con tus credenciales reales
npm run dev            # Inicia con nodemon (recarga automática)
```

## Deploy en cPanel (Setup Node.js App)

1. En cPanel → **Setup Node.js App** → Create Application
2. Node.js version: 18.x o superior
3. Application mode: Production
4. Application root: la carpeta donde subiste el proyecto
5. Application startup file: `src/app.js`
6. Agregar variables de entorno desde tu `.env`
7. Ejecutar `npm install` desde la terminal de cPanel

---

## Endpoints de la API

### Auth
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/auth/login` | Público | Login, retorna JWT |
| GET | `/api/auth/me` | Autenticado | Usuario actual |

### Tickets
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/tickets` | Todos | Listar tickets (filtrado por rol) |
| GET | `/api/tickets/:id` | Todos | Ver ticket + comentarios |
| POST | `/api/tickets` | Todos | Crear ticket |
| PATCH | `/api/tickets/:id` | Admin, Agente | Actualizar estado/prioridad |
| POST | `/api/tickets/:id/comentarios` | Todos | Agregar comentario |

### Usuarios
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/usuarios` | Admin | Listar usuarios |
| POST | `/api/usuarios` | Admin | Crear usuario |
| PATCH | `/api/usuarios/:id` | Admin | Actualizar usuario |
| GET | `/api/usuarios/agentes` | Admin | Listar agentes (para reasignar) |

### Catálogos
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/api/catalogos/departamentos` | Autenticado | Todos los departamentos |
| GET | `/api/catalogos/categorias?id_departamento=X` | Autenticado | Categorías por departamento |
| GET | `/api/catalogos/estados` | Autenticado | Estados disponibles |
| GET | `/api/catalogos/prioridades` | Autenticado | Prioridades disponibles |

---

## Lógica de roles

| Acción | Admin | Agente | Cliente |
|--------|-------|--------|---------|
| Ver todos los tickets | ✅ | Solo su depto | Solo los suyos |
| Crear ticket | ✅ | ✅ | ✅ |
| Cambiar estado/prioridad | ✅ | ✅ | ❌ |
| Reasignar agente | ✅ | ❌ | ❌ |
| Notas internas | ✅ | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |

## Asignación automática de agentes
Al crear un ticket, el sistema busca el agente del departamento seleccionado
con menos tickets activos (round-robin por carga). El admin puede reasignar
manualmente después con `PATCH /api/tickets/:id`.
