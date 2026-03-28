const db = require('../config/db')

/**
 * Asigna automáticamente el agente con menos tickets abiertos
 * en el departamento indicado (round-robin por carga).
 *
 * @param {number} id_departamento
 * @returns {number|null} id_usuario del agente asignado, o null si no hay agentes
 */
const asignarAgente = async (id_departamento) => {
  const [agentes] = await db.query(`
    SELECT u.id_usuario,
           COUNT(t.id_ticket) AS tickets_activos
    FROM   dim_usuario u
    JOIN   dim_rol r ON r.id_rol = u.id_rol AND r.nombre = 'agente'
    LEFT JOIN fact_ticket t
           ON t.id_usuario_asignado = u.id_usuario
          AND t.id_estado NOT IN (
                SELECT id_estado FROM dim_estado
                WHERE nombre IN ('Resuelto', 'Cerrado')
              )
    WHERE  u.id_departamento = ?
      AND  u.activo = 1
    GROUP  BY u.id_usuario
    ORDER  BY tickets_activos ASC
    LIMIT  1
  `, [id_departamento])

  return agentes[0]?.id_usuario ?? null
}

module.exports = { asignarAgente }
