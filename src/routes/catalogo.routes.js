const router = require('express').Router()
const { body } = require('express-validator')
const ctrl   = require('../controllers/catalogo.controller')
const { authenticate, authorize } = require('../middlewares/auth')
const { validate } = require('../middlewares/error')

router.use(authenticate)

// ── Lectura (todos los roles) ────────────────────────────────
router.get('/roles',         ctrl.roles)
router.get('/departamentos', ctrl.departamentos)
router.get('/categorias',    ctrl.categorias)
router.get('/estados',       ctrl.estados)
router.get('/prioridades',   ctrl.prioridades)

// ── Departamentos (admin) ────────────────────────────────────
router.post('/departamentos',
  authorize('admin'),
  [body('nombre').notEmpty().trim().withMessage('Nombre requerido'), validate],
  ctrl.crearDepartamento
)
router.patch('/departamentos/:id', authorize('admin'), ctrl.actualizarDepartamento)

// ── Categorías (admin) ───────────────────────────────────────
router.post('/categorias',
  authorize('admin'),
  [
    body('id_departamento').isInt({ min: 1 }).withMessage('Departamento requerido'),
    body('nombre').notEmpty().trim().withMessage('Nombre requerido'),
    validate,
  ],
  ctrl.crearCategoria
)
router.patch('/categorias/:id', authorize('admin'), ctrl.actualizarCategoria)

// ── Estados (admin) ──────────────────────────────────────────
router.post('/estados',
  authorize('admin'),
  [body('nombre').notEmpty().trim().withMessage('Nombre requerido'), validate],
  ctrl.crearEstado
)
router.patch('/estados/:id', authorize('admin'), ctrl.actualizarEstado)

// ── Prioridades (admin) ──────────────────────────────────────
router.post('/prioridades',
  authorize('admin'),
  [body('nombre').notEmpty().trim().withMessage('Nombre requerido'), validate],
  ctrl.crearPrioridad
)
router.patch('/prioridades/:id', authorize('admin'), ctrl.actualizarPrioridad)

module.exports = router

