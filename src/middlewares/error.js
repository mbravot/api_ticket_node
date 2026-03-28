const { validationResult } = require('express-validator')

// Captura errores de express-validator y responde 422
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ ok: false, errors: errors.array() })
  }
  next()
}

// Handler global de errores (va al final de app.js)
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err)
  const status = err.status || 500
  res.status(status).json({
    ok:      false,
    message: err.message || 'Error interno del servidor',
  })
}

module.exports = { validate, errorHandler }
