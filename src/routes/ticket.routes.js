const router = require('express').Router()
const { body, param } = require('express-validator')
const ctrl = require('../controllers/ticket.controller')
const { authenticate, authorize } = require('../middlewares/auth')
const { validate } = require('../middlewares/error')

// Todas las rutas requieren autenticación
router.use(authenticate)

// Listar tickets
router.get('/', ctrl.listar)

// Obtener un ticket con sus comentarios
router.get('/:id',
  [param('id').isInt(), validate],
  ctrl.obtener
)

// Crear ticket (cualquier rol autenticado)
router.post('/',
  [
    body('id_departamento').isInt({ min: 1 }).withMessage('Departamento requerido'),
    body('id_categoria').isInt({ min: 1 }).withMessage('Categoría requerida'),
    body('id_prioridad').isInt({ min: 1 }).withMessage('Prioridad requerida'),
    body('titulo').notEmpty().trim().withMessage('Título requerido'),
    body('descripcion').notEmpty().trim().withMessage('Descripción requerida'),
    validate,
  ],
  ctrl.crear
)

// Actualizar estado / prioridad / reasignar (agente y admin)
router.patch('/:id',
  authorize('admin', 'agente'),
  [param('id').isInt(), validate],
  ctrl.actualizar
)

// Agregar comentario (todos los roles)
router.post('/:id/comentarios',
  [
    param('id').isInt(),
    body('contenido').notEmpty().trim().withMessage('Contenido requerido'),
    validate,
  ],
  ctrl.comentar
)

module.exports = router
