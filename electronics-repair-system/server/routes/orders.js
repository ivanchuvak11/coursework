const router = require('express').Router();
const pool = require('../db');

// Отримати всі замовлення
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, d.device_type, d.brand, d.model, c.full_name, c.phone 
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            ORDER BY o.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Створити нове замовлення
router.post('/', async (req, res) => {
    const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;
    const client = await pool.query(
        'INSERT INTO clients (full_name, phone) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET full_name = $1 RETURNING id',
        [clientName, clientPhone]
    );
    const device = await pool.query(
        'INSERT INTO devices (client_id, device_type, brand, model, issue_description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [client.rows[0].id, deviceType, brand, model, issueDescription]
    );
    const order = await pool.query(
        'INSERT INTO orders (device_id, status) VALUES ($1, $2) RETURNING *',
        [device.rows[0].id, 'прийнято']
    );
    res.json(order.rows[0]);
});

// Оновити статус замовлення
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    const result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.id]
    );
    res.json(result.rows[0]);
});

// Додати використані деталі
router.post('/:id/parts', async (req, res) => {
    const { partId, quantity } = req.body;
    const part = await pool.query('SELECT price FROM spare_parts WHERE id = $1', [partId]);
    const totalPrice = part.rows[0].price * quantity;
    
    await pool.query(
        'INSERT INTO order_parts (order_id, part_id, quantity_used, total_price) VALUES ($1, $2, $3, $4)',
        [req.params.id, partId, quantity, totalPrice]
    );
    
    await pool.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);
    res.json({ success: true });
});

module.exports = router;