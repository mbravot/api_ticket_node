const db                = require('../config/db')
const { asignarAgente } = require('../services/asignacion.service')
const path              = require('path')
const fs                = require('fs')

// GET /api/tickets
// - admin/agente ven todos (filtrado por depto si es agente)
// - usuario solo ve los suyos
const listar = async (req, res, next) => {
  try {
    const { rol, id_usuario, id_departamento } = req.user
    const { estado, prioridad, pagina = 1, limite = 20 } = req.query

    let where  = []
    let params = []

    if (rol === 'usuario') {
      where.push('t.id_usuario_creador = ?')
      params.push(id_usuario)
    } else if (rol === 'agente') {
      where.push('t.id_departamento = ?')
      params.push(id_departamento)
    }
    // admin ve todo sin filtro adicional

    if (estado) {
      where.push('e.nombre = ?')
      params.push(estado)
    }
    if (prioridad) {
      where.push('p.nombre = ?')
      params.push(prioridad)
    }
    if (req.query.buscar) {
      where.push('t.titulo LIKE ?')
      params.push(`%${req.query.buscar}%`)
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const offset      = (parseInt(pagina) - 1) * parseInt(limite)

    const [tickets] = await db.query(`
      SELECT t.id_ticket, t.titulo, t.created_at, t.updated_at, t.closed_at,
             e.nombre AS estado,    e.color_hex AS estado_color,
             p.nombre AS prioridad, p.color_hex AS prioridad_color,
             d.nombre AS departamento,
             c.nombre AS categoria,
             CONCAT(uc.nombre, ' ', uc.apellido) AS creador,
             CONCAT(ua.nombre, ' ', ua.apellido) AS asignado
      FROM   fact_ticket t
      JOIN   dim_estado      e  ON e.id_estado      = t.id_estado
      JOIN   dim_prioridad   p  ON p.id_prioridad   = t.id_prioridad
      JOIN   dim_departamento d  ON d.id_departamento = t.id_departamento
      JOIN   dim_categoria   c  ON c.id_categoria   = t.id_categoria
      JOIN   dim_usuario     uc ON uc.id_usuario     = t.id_usuario_creador
      LEFT JOIN dim_usuario  ua ON ua.id_usuario     = t.id_usuario_asignado
      ${whereClause}
      ORDER  BY t.created_at DESC
      LIMIT  ? OFFSET ?
    `, [...params, parseInt(limite), offset])

    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM   fact_ticket t
      JOIN   dim_estado      e ON e.id_estado      = t.id_estado
      JOIN   dim_prioridad   p ON p.id_prioridad   = t.id_prioridad
      LEFT JOIN dim_usuario  ua ON ua.id_usuario   = t.id_usuario_asignado
      ${whereClause}
    `, params)

    res.json({ ok: true, total, pagina: parseInt(pagina), limite: parseInt(limite), tickets })
  } catch (err) {
    next(err)
  }
}

// GET /api/tickets/:id
const obtener = async (req, res, next) => {
  try {
    const { id } = req.params
    const { rol, id_usuario, id_departamento } = req.user

    const [rows] = await db.query(`
      SELECT t.*,
             e.nombre AS estado,    e.color_hex AS estado_color,
             p.nombre AS prioridad, p.color_hex AS prioridad_color,
             d.nombre AS departamento,
             c.nombre AS categoria,
             CONCAT(uc.nombre, ' ', uc.apellido) AS creador,
             CONCAT(ua.nombre, ' ', ua.apellido) AS asignado
      FROM   fact_ticket t
      JOIN   dim_estado      e  ON e.id_estado       = t.id_estado
      JOIN   dim_prioridad   p  ON p.id_prioridad    = t.id_prioridad
      JOIN   dim_departamento d  ON d.id_departamento = t.id_departamento
      JOIN   dim_categoria   c  ON c.id_categoria    = t.id_categoria
      JOIN   dim_usuario     uc ON uc.id_usuario      = t.id_usuario_creador
      LEFT JOIN dim_usuario  ua ON ua.id_usuario      = t.id_usuario_asignado
      WHERE  t.id_ticket = ?
    `, [id])

    const ticket = rows[0]
    if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket no encontrado' })

    // Control de acceso: usuario solo ve sus tickets, agente solo los de su depto
    if (rol === 'usuario' && ticket.id_usuario_creador !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin acceso a este ticket' })
    }
    if (rol === 'agente' && ticket.id_departamento !== id_departamento) {
      return res.status(403).json({ ok: false, message: 'Sin acceso a este ticket' })
    }

    // Comentarios (usuario no ve internos)
    const [comentarios] = await db.query(`
      SELECT cm.id_comentario, cm.contenido, cm.es_interno, cm.created_at,
             CONCAT(u.nombre, ' ', u.apellido) AS autor,
             r.nombre AS rol_autor
      FROM   fact_comentario cm
      JOIN   dim_usuario u ON u.id_usuario = cm.id_usuario
      JOIN   dim_rol     r ON r.id_rol     = u.id_rol
      WHERE  cm.id_ticket = ?
        ${rol === 'usuario' ? 'AND cm.es_interno = 0' : ''}
      ORDER  BY cm.created_at ASC
    `, [id])

    const [adjuntos] = await db.query(`
      SELECT a.id_adjunto, a.nombre_original, a.mime_type, a.tamanio, a.created_at,
             CONCAT(u.nombre, ' ', u.apellido) AS subido_por,
             a.id_usuario
      FROM   fact_adjunto a
      JOIN   dim_usuario u ON u.id_usuario = a.id_usuario
      WHERE  a.id_ticket = ?
      ORDER  BY a.created_at ASC
    `, [id])

    res.json({ ok: true, ticket, comentarios, adjuntos })
  } catch (err) {
    next(err)
  }
}

// POST /api/tickets
const crear = async (req, res, next) => {
  try {
    const { id_usuario } = req.user
    const { id_departamento, id_categoria, id_prioridad, titulo, descripcion } = req.body

    // Estado inicial: Abierto
    const [[estado]] = await db.query(
      `SELECT id_estado FROM dim_estado WHERE nombre = 'Abierto' LIMIT 1`
    )
    if (!estado) return res.status(500).json({ ok: false, message: 'Estado inicial no configurado' })

    // Asignación automática
    const id_usuario_asignado = await asignarAgente(id_departamento)

    const [result] = await db.query(`
      INSERT INTO fact_ticket
        (id_usuario_creador, id_usuario_asignado, id_departamento,
         id_categoria, id_estado, id_prioridad, titulo, descripcion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id_usuario, id_usuario_asignado, id_departamento,
        id_categoria, estado.id_estado, id_prioridad, titulo, descripcion])

    res.status(201).json({ ok: true, id_ticket: result.insertId, id_usuario_asignado })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/tickets/:id  — actualizar estado, prioridad o reasignar agente
const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params
    const { rol, id_departamento: deptoUsuario } = req.user
    const { id_estado, id_prioridad, id_usuario_asignado } = req.body

    const campos = []
    const valores = []

    if (id_estado !== undefined) {
      campos.push('id_estado = ?')
      valores.push(id_estado)

      // Si el nuevo estado es Resuelto o Cerrado, registrar fecha
      const [[est]] = await db.query(
        `SELECT nombre FROM dim_estado WHERE id_estado = ?`, [id_estado]
      )
      if (['Resuelto', 'Cerrado'].includes(est?.nombre)) {
        campos.push('closed_at = NOW()')
      }
    }

    if (id_prioridad !== undefined) {
      campos.push('id_prioridad = ?')
      valores.push(id_prioridad)
    }

    // Admin o agente del mismo departamento puede reasignar
    if (id_usuario_asignado !== undefined) {
      let puedeReasignar = rol === 'admin'
      if (rol === 'agente') {
        const [[ticket]] = await db.query(
          `SELECT id_departamento FROM fact_ticket WHERE id_ticket = ?`, [id]
        )
        puedeReasignar = ticket?.id_departamento === deptoUsuario
      }
      if (puedeReasignar) {
        campos.push('id_usuario_asignado = ?')
        valores.push(id_usuario_asignado)
      }
    }

    if (!campos.length) {
      return res.status(400).json({ ok: false, message: 'Nada que actualizar' })
    }

    valores.push(id)
    await db.query(
      `UPDATE fact_ticket SET ${campos.join(', ')} WHERE id_ticket = ?`,
      valores
    )

    res.json({ ok: true, message: 'Ticket actualizado' })
  } catch (err) {
    next(err)
  }
}

// POST /api/tickets/:id/comentarios
const comentar = async (req, res, next) => {
  try {
    const { id }        = req.params
    const { id_usuario, rol } = req.user
    const { contenido, es_interno = false } = req.body

    // Clientes no pueden dejar notas internas
    const interno = rol === 'usuario' ? 0 : (es_interno ? 1 : 0)

    const [result] = await db.query(`
      INSERT INTO fact_comentario (id_ticket, id_usuario, contenido, es_interno)
      VALUES (?, ?, ?, ?)
    `, [id, id_usuario, contenido, interno])

    await db.query(`UPDATE fact_ticket SET updated_at = NOW() WHERE id_ticket = ?`, [id])

    res.status(201).json({ ok: true, id_comentario: result.insertId })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/tickets/:id/comentarios/:comentarioId — autor o admin
const editarComentario = async (req, res, next) => {
  try {
    const { comentarioId } = req.params
    const { id_usuario, rol } = req.user
    const { contenido } = req.body

    if (!contenido?.trim()) {
      return res.status(400).json({ ok: false, message: 'El contenido es requerido' })
    }

    const [[comentario]] = await db.query(
      `SELECT id_comentario, id_usuario FROM fact_comentario WHERE id_comentario = ?`, [comentarioId]
    )
    if (!comentario) return res.status(404).json({ ok: false, message: 'Comentario no encontrado' })
    if (rol !== 'admin' && comentario.id_usuario !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para editar este comentario' })
    }

    await db.query(`UPDATE fact_comentario SET contenido = ? WHERE id_comentario = ?`, [contenido.trim(), comentarioId])
    res.json({ ok: true, message: 'Comentario actualizado' })
  } catch (err) { next(err) }
}

// DELETE /api/tickets/:id/comentarios/:comentarioId — autor o admin
const eliminarComentario = async (req, res, next) => {
  try {
    const { comentarioId } = req.params
    const { id_usuario, rol } = req.user

    const [[comentario]] = await db.query(
      `SELECT id_comentario, id_usuario FROM fact_comentario WHERE id_comentario = ?`, [comentarioId]
    )
    if (!comentario) return res.status(404).json({ ok: false, message: 'Comentario no encontrado' })
    if (rol !== 'admin' && comentario.id_usuario !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para eliminar este comentario' })
    }

    await db.query(`DELETE FROM fact_comentario WHERE id_comentario = ?`, [comentarioId])
    res.json({ ok: true, message: 'Comentario eliminado' })
  } catch (err) { next(err) }
}

// POST /api/tickets/:id/adjuntos
const subirAdjunto = async (req, res, next) => {
  try {
    const { id } = req.params
    const { id_usuario } = req.user

    if (!req.file) return res.status(400).json({ ok: false, message: 'No se recibió ningún archivo' })

    const [[ticket]] = await db.query(`SELECT id_ticket FROM fact_ticket WHERE id_ticket = ?`, [id])
    if (!ticket) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ ok: false, message: 'Ticket no encontrado' })
    }

    const [result] = await db.query(`
      INSERT INTO fact_adjunto (id_ticket, id_usuario, nombre_original, nombre_archivo, mime_type, tamanio)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, id_usuario, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size])

    res.status(201).json({ ok: true, id_adjunto: result.insertId })
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path)
    next(err)
  }
}

// GET /api/tickets/:id/adjuntos
const listarAdjuntos = async (req, res, next) => {
  try {
    const { id } = req.params

    const [adjuntos] = await db.query(`
      SELECT a.id_adjunto, a.nombre_original, a.mime_type, a.tamanio, a.created_at,
             CONCAT(u.nombre, ' ', u.apellido) AS subido_por
      FROM   fact_adjunto a
      JOIN   dim_usuario u ON u.id_usuario = a.id_usuario
      WHERE  a.id_ticket = ?
      ORDER  BY a.created_at ASC
    `, [id])

    res.json({ ok: true, adjuntos })
  } catch (err) {
    next(err)
  }
}

// GET /api/tickets/:id/adjuntos/:id_adjunto/descargar
const descargarAdjunto = async (req, res, next) => {
  try {
    const { id_adjunto } = req.params

    const [[adjunto]] = await db.query(
      `SELECT nombre_original, nombre_archivo, mime_type FROM fact_adjunto WHERE id_adjunto = ?`,
      [id_adjunto]
    )
    if (!adjunto) return res.status(404).json({ ok: false, message: 'Adjunto no encontrado' })

    const filePath = path.join(__dirname, '../../uploads', adjunto.nombre_archivo)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, message: 'Archivo no encontrado en el servidor' })

    res.setHeader('Content-Disposition', `attachment; filename="${adjunto.nombre_original}"`)
    res.setHeader('Content-Type', adjunto.mime_type)
    res.sendFile(filePath)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/tickets/:id/adjuntos/:id_adjunto — autor o admin
const eliminarAdjunto = async (req, res, next) => {
  try {
    const { id_adjunto } = req.params
    const { id_usuario, rol } = req.user

    const [[adjunto]] = await db.query(
      `SELECT id_usuario, nombre_archivo FROM fact_adjunto WHERE id_adjunto = ?`,
      [id_adjunto]
    )
    if (!adjunto) return res.status(404).json({ ok: false, message: 'Adjunto no encontrado' })

    if (rol !== 'admin' && adjunto.id_usuario !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para eliminar este adjunto' })
    }

    const filePath = path.join(__dirname, '../../uploads', adjunto.nombre_archivo)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    await db.query(`DELETE FROM fact_adjunto WHERE id_adjunto = ?`, [id_adjunto])

    res.json({ ok: true, message: 'Adjunto eliminado' })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/tickets/:id — solo admin
const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params

    const [[ticket]] = await db.query(
      `SELECT id_ticket FROM fact_ticket WHERE id_ticket = ?`, [id]
    )
    if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket no encontrado' })

    await db.query(`DELETE FROM fact_ticket WHERE id_ticket = ?`, [id])

    res.json({ ok: true, message: 'Ticket eliminado' })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, obtener, crear, actualizar, comentar, editarComentario, eliminarComentario, eliminar, subirAdjunto, listarAdjuntos, descargarAdjunto, eliminarAdjunto }
