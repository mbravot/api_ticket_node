const path = require('path')
const fs   = require('fs')
const db   = require('../config/db')

// POST /api/tickets/:id/adjuntos
const subir = async (req, res, next) => {
  try {
    const { id } = req.params
    const { id_usuario } = req.user

    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No se recibió ningún archivo' })
    }

    const { originalname, filename, mimetype, size } = req.file

    const [result] = await db.query(`
      INSERT INTO fact_adjunto (id_ticket, id_usuario, nombre_original, nombre_archivo, mime_type, tamanio)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, id_usuario, originalname, filename, mimetype, size])

    res.status(201).json({
      ok: true,
      adjunto: {
        id_adjunto: result.insertId,
        nombre_original: originalname,
        nombre_archivo: filename,
        mime_type: mimetype,
        tamanio: size,
      },
    })
  } catch (err) { next(err) }
}

// GET /api/adjuntos/:adjuntoId/download
const descargar = async (req, res, next) => {
  try {
    const { adjuntoId } = req.params

    const [[adjunto]] = await db.query(
      `SELECT nombre_original, nombre_archivo FROM fact_adjunto WHERE id_adjunto = ?`, [adjuntoId]
    )
    if (!adjunto) return res.status(404).json({ ok: false, message: 'Archivo no encontrado' })

    const filePath = path.join(__dirname, '../../uploads', adjunto.nombre_archivo)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, message: 'Archivo no encontrado en el servidor' })
    }

    res.download(filePath, adjunto.nombre_original)
  } catch (err) { next(err) }
}

// DELETE /api/adjuntos/:adjuntoId — autor o admin
const eliminar = async (req, res, next) => {
  try {
    const { adjuntoId } = req.params
    const { id_usuario, rol } = req.user

    const [[adjunto]] = await db.query(
      `SELECT id_adjunto, id_usuario, nombre_archivo FROM fact_adjunto WHERE id_adjunto = ?`, [adjuntoId]
    )
    if (!adjunto) return res.status(404).json({ ok: false, message: 'Archivo no encontrado' })
    if (rol !== 'admin' && adjunto.id_usuario !== id_usuario) {
      return res.status(403).json({ ok: false, message: 'Sin permiso para eliminar este archivo' })
    }

    const filePath = path.join(__dirname, '../../uploads', adjunto.nombre_archivo)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    await db.query(`DELETE FROM fact_adjunto WHERE id_adjunto = ?`, [adjuntoId])
    res.json({ ok: true, message: 'Archivo eliminado' })
  } catch (err) { next(err) }
}

module.exports = { subir, descargar, eliminar }
