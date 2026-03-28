const router = require('express').Router()
const { body } = require('express-validator')
const { login, me } = require('../controllers/auth.controller')
const { authenticate } = require('../middlewares/auth')
const { validate } = require('../middlewares/error')

router.post('/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Password requerido'),
    validate,
  ],
  login
)

router.get('/me', authenticate, me)

module.exports = router
