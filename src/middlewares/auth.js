const jwt = require('jsonwebtoken')

// Verifica que el token JWT sea válido
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer <token>

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token requerido' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload // { id_usuario, email, rol, id_departamento }
    next()
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' })
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ ok: false, message: 'Sin permiso para esta acción' })
  }
  next()
}

module.exports = { authenticate, authorize }
