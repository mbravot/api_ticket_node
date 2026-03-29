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
router.patch('/departamentos/:id',  authorize('admin'), ctrl.actualizarDepartamento)
router.delete('/departamentos/:id', authorize('admin'), ctrl.eliminarDepartamento)

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
router.patch('/categorias/:id',  authorize('admin'), ctrl.actualizarCategoria)
router.delete('/categorias/:id', authorize('admin'), ctrl.eliminarCategoria)

// ── Estados (admin) ──────────────────────────────────────────
router.post('/estados',
  authorize('admin'),
  [body('nombre').notEmpty().trim().withMessage('Nombre requerido'), validate],
  ctrl.crearEstado
)
router.patch('/estados/:id',  authorize('admin'), ctrl.actualizarEstado)
router.delete('/estados/:id', authorize('admin'), ctrl.eliminarEstado)

// ── Prioridades (admin) ──────────────────────────────────────
router.post('/prioridades',
  authorize('admin'),
  [body('nombre').notEmpty().trim().withMessage('Nombre requerido'), validate],
  ctrl.crearPrioridad
)
router.patch('/prioridades/:id',  authorize('admin'), ctrl.actualizarPrioridad)
router.delete('/prioridades/:id', authorize('admin'), ctrl.eliminarPrioridad)

module.exports = router

