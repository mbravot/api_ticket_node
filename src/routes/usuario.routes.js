const router  = require('express').Router()
const { body } = require('express-validator')
const ctrl    = require('../controllers/usuario.controller')
const { authenticate, authorize } = require('../middlewares/auth')
const { validate } = require('../middlewares/error')

router.use(authenticate)

// Listar agentes (admin — para reasignación manual)
// OJO: debe ir ANTES de /:id para que no sea capturado como id='agentes'
router.get('/agentes', authorize('admin'), ctrl.listarAgentes)

// Listar todos los usuarios (admin)
router.get('/', authorize('admin'), ctrl.listar)

// Obtener usuario por id (admin)
router.get('/:id', authorize('admin'), ctrl.obtener)

// Crear usuario (admin)
router.post('/',
  authorize('admin'),
  [
    body('nombre').notEmpty().trim(),
    body('apellido').notEmpty().trim(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
    body('id_rol').isInt({ min: 1 }),
    validate,
  ],
  ctrl.crear
)

// Actualizar usuario (admin)
router.patch('/:id', authorize('admin'), ctrl.actualizar)

// Cambiar contraseña (el propio usuario o admin)
router.patch('/:id/password',
  [
    body('password_nuevo').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
    validate,
  ],
  ctrl.cambiarPassword
)

module.exports = router
