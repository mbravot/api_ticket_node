const db = require('../config/db')

// ── Lectura ──────────────────────────────────────────────────

// GET /api/catalogos/roles
const roles = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id_rol, nombre, descripcion FROM dim_rol WHERE activo = 1 ORDER BY id_rol`
    )
    res.json({ ok: true, roles: rows })
  } catch (err) { next(err) }
}

// GET /api/catalogos/departamentos
const departamentos = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id_departamento, nombre, descripcion, activo FROM dim_departamento ORDER BY nombre`
    )
    res.json({ ok: true, departamentos: rows })
  } catch (err) { next(err) }
}

// GET /api/catalogos/categorias?id_departamento=X
const categorias = async (req, res, next) => {
  try {
    const { id_departamento } = req.query
    const where = id_departamento ? 'AND id_departamento = ?' : ''
    const [rows] = await db.query(
      `SELECT id_categoria, id_departamento, nombre, descripcion, activo
       FROM dim_categoria WHERE 1=1 ${where} ORDER BY nombre`,
      id_departamento ? [id_departamento] : []
    )
    res.json({ ok: true, categorias: rows })
  } catch (err) { next(err) }
}

// GET /api/catalogos/estados
const estados = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id_estado, nombre, color_hex, orden FROM dim_estado ORDER BY orden`
    )
    res.json({ ok: true, estados: rows })
  } catch (err) { next(err) }
}

// GET /api/catalogos/prioridades
const prioridades = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id_prioridad, nombre, color_hex, nivel FROM dim_prioridad ORDER BY nivel`
    )
    res.json({ ok: true, prioridades: rows })
  } catch (err) { next(err) }
}

// ── CRUD Departamentos (admin) ───────────────────────────────

// POST /api/catalogos/departamentos
const crearDepartamento = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body
    const [r] = await db.query(
      `INSERT INTO dim_departamento (nombre, descripcion) VALUES (?, ?)`,
      [nombre, descripcion ?? null]
    )
    res.status(201).json({ ok: true, id_departamento: r.insertId })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ ok: false, message: 'Ese departamento ya existe' })
    next(err)
  }
}

// PATCH /api/catalogos/departamentos/:id
const actualizarDepartamento = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, descripcion, activo } = req.body
    await db.query(`
      UPDATE dim_departamento
      SET nombre      = COALESCE(?, nombre),
          descripcion = COALESCE(?, descripcion),
          activo      = COALESCE(?, activo)
      WHERE id_departamento = ?
    `, [nombre, descripcion, activo, id])
    res.json({ ok: true, message: 'Departamento actualizado' })
  } catch (err) { next(err) }
}

// DELETE /api/catalogos/departamentos/:id
const eliminarDepartamento = async (req, res, next) => {
  try {
    const { id } = req.params
    await db.query(`DELETE FROM dim_departamento WHERE id_departamento = ?`, [id])
    res.json({ ok: true, message: 'Departamento eliminado' })
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2')
      return res.status(409).json({ ok: false, message: 'No se puede eliminar: tiene categorías o usuarios asociados' })
    next(err)
  }
}

// ── CRUD Categorías (admin) ──────────────────────────────────

// POST /api/catalogos/categorias
const crearCategoria = async (req, res, next) => {
  try {
    const { id_departamento, nombre, descripcion } = req.body
    const [r] = await db.query(
      `INSERT INTO dim_categoria (id_departamento, nombre, descripcion) VALUES (?, ?, ?)`,
      [id_departamento, nombre, descripcion ?? null]
    )
    res.status(201).json({ ok: true, id_categoria: r.insertId })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ ok: false, message: 'Esa categoría ya existe en ese departamento' })
    next(err)
  }
}

// PATCH /api/catalogos/categorias/:id
const actualizarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, descripcion, activo, id_departamento } = req.body
    await db.query(`
      UPDATE dim_categoria
      SET nombre          = COALESCE(?, nombre),
          descripcion     = COALESCE(?, descripcion),
          activo          = COALESCE(?, activo),
          id_departamento = COALESCE(?, id_departamento)
      WHERE id_categoria = ?
    `, [nombre, descripcion, activo, id_departamento, id])
    res.json({ ok: true, message: 'Categoría actualizada' })
  } catch (err) { next(err) }
}

// DELETE /api/catalogos/categorias/:id
const eliminarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params
    await db.query(`DELETE FROM dim_categoria WHERE id_categoria = ?`, [id])
    res.json({ ok: true, message: 'Categoría eliminada' })
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2')
      return res.status(409).json({ ok: false, message: 'No se puede eliminar: tiene tickets asociados' })
    next(err)
  }
}

// ── CRUD Estados (admin) ─────────────────────────────────────

// POST /api/catalogos/estados
const crearEstado = async (req, res, next) => {
  try {
    const { nombre, color_hex, orden } = req.body
    const [r] = await db.query(
      `INSERT INTO dim_estado (nombre, color_hex, orden) VALUES (?, ?, ?)`,
      [nombre, color_hex ?? '#888888', orden ?? 0]
    )
    res.status(201).json({ ok: true, id_estado: r.insertId })
  } catch (err) { next(err) }
}

// PATCH /api/catalogos/estados/:id
const actualizarEstado = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, color_hex, orden } = req.body
    await db.query(`
      UPDATE dim_estado
      SET nombre    = COALESCE(?, nombre),
          color_hex = COALESCE(?, color_hex),
          orden     = COALESCE(?, orden)
      WHERE id_estado = ?
    `, [nombre, color_hex, orden, id])
    res.json({ ok: true, message: 'Estado actualizado' })
  } catch (err) { next(err) }
}

// DELETE /api/catalogos/estados/:id
const eliminarEstado = async (req, res, next) => {
  try {
    const { id } = req.params
    await db.query(`DELETE FROM dim_estado WHERE id_estado = ?`, [id])
    res.json({ ok: true, message: 'Estado eliminado' })
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2')
      return res.status(409).json({ ok: false, message: 'No se puede eliminar: tiene tickets asociados' })
    next(err)
  }
}

// ── CRUD Prioridades (admin) ─────────────────────────────────

// POST /api/catalogos/prioridades
const crearPrioridad = async (req, res, next) => {
  try {
    const { nombre, color_hex, nivel } = req.body
    const [r] = await db.query(
      `INSERT INTO dim_prioridad (nombre, color_hex, nivel) VALUES (?, ?, ?)`,
      [nombre, color_hex ?? '#888888', nivel ?? 1]
    )
    res.status(201).json({ ok: true, id_prioridad: r.insertId })
  } catch (err) { next(err) }
}

// PATCH /api/catalogos/prioridades/:id
const actualizarPrioridad = async (req, res, next) => {
  try {
    const { id } = req.params
    const { nombre, color_hex, nivel } = req.body
    await db.query(`
      UPDATE dim_prioridad
      SET nombre    = COALESCE(?, nombre),
          color_hex = COALESCE(?, color_hex),
          nivel     = COALESCE(?, nivel)
      WHERE id_prioridad = ?
    `, [nombre, color_hex, nivel, id])
    res.json({ ok: true, message: 'Prioridad actualizada' })
  } catch (err) { next(err) }
}

// DELETE /api/catalogos/prioridades/:id
const eliminarPrioridad = async (req, res, next) => {
  try {
    const { id } = req.params
    await db.query(`DELETE FROM dim_prioridad WHERE id_prioridad = ?`, [id])
    res.json({ ok: true, message: 'Prioridad eliminada' })
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2')
      return res.status(409).json({ ok: false, message: 'No se puede eliminar: tiene tickets asociados' })
    next(err)
  }
}

module.exports = {
  roles,
  departamentos, crearDepartamento, actualizarDepartamento, eliminarDepartamento,
  categorias,    crearCategoria,    actualizarCategoria,    eliminarCategoria,
  estados,       crearEstado,       actualizarEstado,       eliminarEstado,
  prioridades,   crearPrioridad,    actualizarPrioridad,    eliminarPrioridad,
}
