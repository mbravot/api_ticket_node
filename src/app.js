require('dotenv').config()

const express = require('express')
const cors    = require('cors')

const authRoutes     = require('./routes/auth.routes')
const ticketRoutes   = require('./routes/ticket.routes')
const usuarioRoutes  = require('./routes/usuario.routes')
const catalogoRoutes = require('./routes/catalogo.routes')
const reporteRoutes  = require('./routes/reporte.routes')
const { errorHandler } = require('./middlewares/error')

// Inicializar conexión DB al arrancar
require('./config/db')

const app = express()

// ── Middlewares globales ─────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}))
app.use(express.json())

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/tickets',   ticketRoutes)
app.use('/api/usuarios',  usuarioRoutes)
app.use('/api/catalogos', catalogoRoutes)
app.use('/api/reportes',  reporteRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV })
})

// ── Error handler (debe ir al final) ────────────────────────
app.use(errorHandler)

// ── Servidor ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 API corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`)
})
