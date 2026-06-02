const pool = require('../database/pool');

async function getRandomMasterId(client = pool) {
    const result = await client.query(`
        SELECT id
        FROM masters
        WHERE is_active = TRUE
        ORDER BY RANDOM()
        LIMIT 1
    `);

    return result.rows[0]?.id || null;
}

async function getOrderMasterFields(orderId, client = pool) {
    const result = await client.query(`
        SELECT
            o.assigned_master_id,
            m.full_name AS master_name,
            m.specialization AS master_specialization
        FROM orders o
        LEFT JOIN masters m ON m.id = o.assigned_master_id
        WHERE o.id = $1
    `, [orderId]);

    return result.rows[0] || {};
}

module.exports = {
    getRandomMasterId,
    getOrderMasterFields,
};
