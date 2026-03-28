const router = require('express').Router()
const ctrl   = require('../controllers/reporte.controller')
const { authenticate, authorize } = require('../middlewares/auth')

router.use(authenticate)

// Resumen general — admin y agente (agente ve solo su depto)
router.get('/resumen', ctrl.resumen)

// Rendimiento por agente — solo admin
router.get('/agentes', authorize('admin'), ctrl.agentes)

module.exports = router
