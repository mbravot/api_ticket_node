const bcrypt = require('bcrypt')
const db     = require('../config/db')

// GET /api/usuarios  (admin)
const listar = async (req, res, next) => {
  try {
    const [usuarios] = await db.query(`
      SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.activo, u.created_at,
             r.nombre AS rol, r.id_rol,
             d.nombre AS departamento, d.id_departamento
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol
      LEFT JOIN dim_departamento d ON d.id_departamento = u.id_departamento
      ORDER  BY u.created_at DESC
    `)
    res.json({ ok: true, usuarios })
  } catch (err) {
    next(err)
  }
}

// GET /api/usuarios/:id  (admin)
const obtener = async (req, res, next) => {
  try {
    const { id } = req.params
    const [rows] = await db.query(`
      SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.activo, u.created_at,
             r.nombre AS rol, r.id_rol,
             d.nombre AS departamento, d.id_departamento
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol
      LEFT JOIN dim_departamento d ON d.id_departamento = u.id_departamento
      WHERE  u.id_usuario = ?
    `, [id])
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' })
    res.json({ ok: true, usuario: rows[0] })
  } catch (err) { next(err) }
}

// POST /api/usuarios  (admin)
const crear = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, id_rol, id_departamento } = req.body

    const hash = await bcrypt.hash(password, 10)

    const [result] = await db.query(`
      INSERT INTO dim_usuario (nombre, apellido, email, password_hash, id_rol, id_departamento)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nombre, apellido, email, hash, id_rol, id_departamento ?? null])

    res.status(201).json({ ok: true, id_usuario: result.insertId })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, message: 'El email ya está registrado' })
    }
    next(err)
  }
}

// PATCH /api/usuarios/:id  (admin)
const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, apellido, email, id_rol, id_departamento, activo } = req.body

    await db.query(`
      UPDATE dim_usuario
      SET nombre = COALESCE(?, nombre),
          apellido = COALESCE(?, apellido),
          email = COALESCE(?, email),
          id_rol = COALESCE(?, id_rol),
          id_departamento = ?,
          activo = COALESCE(?, activo)
      WHERE id_usuario = ?
    `, [nombre, apellido, email, id_rol, id_departamento ?? null, activo, id])

    res.json({ ok: true, message: 'Usuario actualizado' })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/usuarios/:id/password  (el propio usuario o admin)
const cambiarPassword = async (req, res, next) => {
  try {
    const { id } = req.params
    const { password_actual, password_nuevo } = req.body
    const { id_usuario, rol } = req.user

    // Solo el propio usuario o un admin puede cambiar la contraseña
    if (rol !== 'admin' && parseInt(id) !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para esta acción' })
    }

    const [[usuario]] = await db.query(
      `SELECT password_hash FROM dim_usuario WHERE id_usuario = ?`, [id]
    )
    if (!usuario) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' })

    // Si no es admin, verificar contraseña actual
    if (rol !== 'admin') {
      const ok = await bcrypt.compare(password_actual, usuario.password_hash)
      if (!ok) return res.status(401).json({ ok: false, message: 'Contraseña actual incorrecta' })
    }

    const hash = await bcrypt.hash(password_nuevo, 10)
    await db.query(`UPDATE dim_usuario SET password_hash = ? WHERE id_usuario = ?`, [hash, id])

    res.json({ ok: true, message: 'Contraseña actualizada' })
  } catch (err) { next(err) }
}

// GET /api/usuarios/agentes?id_departamento=X  (admin — para reasignación)
const listarAgentes = async (req, res, next) => {
  try {
    const { id_departamento } = req.query

    const [agentes] = await db.query(`
      SELECT u.id_usuario,
             CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo,
             u.email,
             d.nombre AS departamento,
             COUNT(t.id_ticket) AS tickets_activos
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol AND r.nombre = 'agente'
      LEFT JOIN dim_departamento d ON d.id_departamento = u.id_departamento
      LEFT JOIN fact_ticket t
             ON t.id_usuario_asignado = u.id_usuario
            AND t.id_estado NOT IN (
                  SELECT id_estado FROM dim_estado WHERE nombre IN ('Resuelto', 'Cerrado')
                )
      WHERE  u.activo = 1
        ${id_departamento ? 'AND u.id_departamento = ?' : ''}
      GROUP  BY u.id_usuario
      ORDER  BY tickets_activos ASC
    `, id_departamento ? [id_departamento] : [])

    res.json({ ok: true, agentes })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarPassword, listarAgentes }
