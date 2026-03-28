const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const db      = require('../config/db')

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Buscar usuario activo con su rol
    const [rows] = await db.query(`
      SELECT u.id_usuario, u.nombre, u.apellido, u.email,
             u.password_hash, u.activo, u.id_departamento,
             r.nombre AS rol
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol
      WHERE  u.email = ?
      LIMIT  1
    `, [email])

    const user = rows[0]

    if (!user || !user.activo) {
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' })
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash)
    if (!passwordOk) {
      return res.status(401).json({ ok: false, message: 'Credenciales inválidas' })
    }

    const payload = {
      id_usuario:      user.id_usuario,
      email:           user.email,
      rol:             user.rol,
      id_departamento: user.id_departamento,
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    })

    res.json({
      ok: true,
      token,
      user: {
        id_usuario:      user.id_usuario,
        nombre:          user.nombre,
        apellido:        user.apellido,
        email:           user.email,
        rol:             user.rol,
        id_departamento: user.id_departamento,
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/me  — devuelve el usuario autenticado actual
const me = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id_usuario, u.nombre, u.apellido, u.email,
             u.activo, u.id_departamento, u.created_at,
             r.nombre AS rol,
             d.nombre AS departamento
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol
      LEFT JOIN dim_departamento d ON d.id_departamento = u.id_departamento
      WHERE  u.id_usuario = ?
    `, [req.user.id_usuario])

    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' })

    res.json({ ok: true, user: rows[0] })
  } catch (err) {
    next(err)
  }
}

module.exports = { login, me }
