const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Підключення до PostgreSQL
const pool = new Pool({
    user: 'postgres',
    password: 'postgres',  // Зміни на свій пароль!
    host: 'localhost',
    port: 5432,
    database: 'repair_workshop'
});

// ============ МАРШРУТИ ДЛЯ ЗАМОВЛЕНЬ ============

// Отримати всі замовлення
app.get('/api/orders', async (req, res) => {
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
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Створити нове замовлення
app.post('/api/orders', async (req, res) => {
    const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;
    try {
        // Додаємо клієнта
        const clientResult = await pool.query(
            'INSERT INTO clients (full_name, phone) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET full_name = $1 RETURNING id',
            [clientName, clientPhone]
        );
        const clientId = clientResult.rows[0].id;
        
        // Додаємо пристрій
        const deviceResult = await pool.query(
            'INSERT INTO devices (client_id, device_type, brand, model, issue_description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [clientId, deviceType, brand, model, issueDescription]
        );
        const deviceId = deviceResult.rows[0].id;
        
        // Додаємо замовлення
        const orderResult = await pool.query(
            'INSERT INTO orders (device_id, status) VALUES ($1, $2) RETURNING *',
            [deviceId, 'прийнято']
        );
        
        res.json(orderResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити статус замовлення
app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ============ МАРШРУТИ ДЛЯ ДЕТАЛЕЙ ============

// Отримати всі деталі
app.get('/api/parts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM spare_parts ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Додати нову деталь
app.post('/api/parts', async (req, res) => {
    const { part_name, quantity, price } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO spare_parts (part_name, quantity, price) VALUES ($1, $2, $3) RETURNING *',
            [part_name, quantity, price]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// SMS сповіщення (симуляція)
app.post('/api/send-status-sms', async (req, res) => {
    const { phone, orderId, status, clientName } = req.body;
    console.log(`📱 [SMS SIMULATION] Надсилаємо до ${phone}: Ваше замовлення #${orderId} змінило статус на "${status}". Дякуємо, ${clientName}!`);
    res.json({ success: true, message: 'SMS відправлено (симуляція)' });
});

// Тестовий маршрут
app.get('/api/test', (req, res) => {
    res.json({ message: 'Сервер працює!', time: new Date().toISOString() });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
    console.log(`📋 Тест: http://localhost:${PORT}/api/test`);
});