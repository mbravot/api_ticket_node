const db = require('../config/db')

// GET /api/reportes/resumen
// Métricas generales para el dashboard
const resumen = async (req, res, next) => {
  try {
    const { rol, id_departamento } = req.user
    const filtroDepto = rol === 'agente' ? 'WHERE t.id_departamento = ?' : ''
    const params = rol === 'agente' ? [id_departamento] : []

    // Totales por estado
    const [porEstado] = await db.query(`
      SELECT e.nombre AS estado, e.color_hex, COUNT(t.id_ticket) AS total
      FROM   dim_estado e
      LEFT JOIN fact_ticket t ON t.id_estado = e.id_estado
        ${rol === 'agente' ? 'AND t.id_departamento = ?' : ''}
      GROUP  BY e.id_estado
      ORDER  BY e.orden
    `, params)

    // Totales por prioridad
    const [porPrioridad] = await db.query(`
      SELECT p.nombre AS prioridad, p.color_hex, COUNT(t.id_ticket) AS total
      FROM   dim_prioridad p
      LEFT JOIN fact_ticket t ON t.id_prioridad = p.id_prioridad
        ${rol === 'agente' ? 'AND t.id_departamento = ?' : ''}
      GROUP  BY p.id_prioridad
      ORDER  BY p.nivel
    `, params)

    // Totales por departamento (solo admin)
    let porDepartamento = []
    if (rol === 'admin') {
      const [rows] = await db.query(`
        SELECT d.nombre AS departamento, COUNT(t.id_ticket) AS total
        FROM   dim_departamento d
        LEFT JOIN fact_ticket t ON t.id_departamento = d.id_departamento
        WHERE  d.activo = 1
        GROUP  BY d.id_departamento
        ORDER  BY total DESC
      `)
      porDepartamento = rows
    }

    // Tiempo promedio de resolución en horas (tickets cerrados/resueltos)
    const [[tiempoPromedio]] = await db.query(`
      SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.closed_at)), 1) AS horas_promedio
      FROM   fact_ticket t
      JOIN   dim_estado e ON e.id_estado = t.id_estado
      WHERE  e.nombre IN ('Resuelto', 'Cerrado')
        AND  t.closed_at IS NOT NULL
        ${rol === 'agente' ? 'AND t.id_departamento = ?' : ''}
    `, params)

    // Tickets creados en los últimos 7 días (para gráfico de línea)
    const [ultimos7dias] = await db.query(`
      SELECT DATE(t.created_at) AS fecha, COUNT(*) AS total
      FROM   fact_ticket t
      ${filtroDepto}
      AND    t.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP  BY DATE(t.created_at)
      ORDER  BY fecha ASC
    `, params)

    // Tickets sin asignar
    const [[sinAsignar]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM   fact_ticket t
      WHERE  t.id_usuario_asignado IS NULL
        ${rol === 'agente' ? 'AND t.id_departamento = ?' : ''}
    `, params)

    res.json({
      ok: true,
      resumen: {
        por_estado:        porEstado,
        por_prioridad:     porPrioridad,
        por_departamento:  porDepartamento,
        tiempo_promedio_hrs: tiempoPromedio?.horas_promedio ?? 0,
        ultimos_7_dias:    ultimos7dias,
        sin_asignar:       sinAsignar?.total ?? 0,
      },
    })
  } catch (err) { next(err) }
}

// GET /api/reportes/agentes
// Rendimiento por agente (solo admin)
const agentes = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT CONCAT(u.nombre, ' ', u.apellido) AS agente,
             d.nombre AS departamento,
             COUNT(t.id_ticket)                              AS total_asignados,
             SUM(e.nombre IN ('Resuelto', 'Cerrado'))        AS total_resueltos,
             ROUND(AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.closed_at)), 1) AS hrs_promedio
      FROM   dim_usuario u
      JOIN   dim_rol r ON r.id_rol = u.id_rol AND r.nombre = 'agente'
      LEFT JOIN dim_departamento d ON d.id_departamento = u.id_departamento
      LEFT JOIN fact_ticket t ON t.id_usuario_asignado = u.id_usuario
      LEFT JOIN dim_estado e ON e.id_estado = t.id_estado
      WHERE  u.activo = 1
      GROUP  BY u.id_usuario
      ORDER  BY total_resueltos DESC
    `)
    res.json({ ok: true, agentes: rows })
  } catch (err) { next(err) }
}

module.exports = { resumen, agentes }
