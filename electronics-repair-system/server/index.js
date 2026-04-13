const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ========== ПІДКЛЮЧЕННЯ ДО БАЗИ ДАНИХ ==========
const pool = new Pool({
    user: 'postgres',      // Твій користувач PostgreSQL
    password: '1',  // ТВІЙ ПАРОЛЬ - ЗМІНИ ЯКЩО ТРЕБА!
    host: 'localhost',
    port: 5432,
    database: 'repair_workshop',
    // Якщо проблема з підключенням, додай:
    // ssl: false,
    // connectionTimeoutMillis: 5000,
});

// Перевірка підключення до БД
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ ПОМИЛКА ПІДКЛЮЧЕННЯ ДО БД:', err.message);
    } else {
        console.log('✅ Підключено до PostgreSQL');
        release();
    }
});

// ========== МАРШРУТИ ДЛЯ ЗАМОВЛЕНЬ ==========

// Отримати всі замовлення (з деталями клієнтів та пристроїв)
app.get('/api/orders', async (req, res) => {
    try {
        const query = `
            SELECT 
                o.id,
                o.status,
                o.repair_cost,
                o.total_cost,
                o.created_at,
                o.updated_at,
                c.full_name,
                c.phone,
                c.email,
                d.device_type,
                d.brand,
                d.model,
                d.serial_number,
                d.issue_description
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання замовлень:', err);
        res.status(500).json({ error: err.message });
    }
});

// Створити нове замовлення
app.post('/api/orders', async (req, res) => {
    const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;
    
    try {
        // Перевіряємо чи існує клієнт
        let clientId;
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE phone = $1',
            [clientPhone]
        );
        
        if (clientCheck.rows.length > 0) {
            clientId = clientCheck.rows[0].id;
            // Оновлюємо ім'я клієнта
            await pool.query(
                'UPDATE clients SET full_name = $1 WHERE id = $2',
                [clientName, clientId]
            );
        } else {
            // Створюємо нового клієнта
            const newClient = await pool.query(
                'INSERT INTO clients (full_name, phone) VALUES ($1, $2) RETURNING id',
                [clientName, clientPhone]
            );
            clientId = newClient.rows[0].id;
        }
        
        // Створюємо пристрій
        const newDevice = await pool.query(
            `INSERT INTO devices (client_id, device_type, brand, model, issue_description) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [clientId, deviceType, brand, model, issueDescription]
        );
        
        // Створюємо замовлення
        const newOrder = await pool.query(
            `INSERT INTO orders (device_id, status) 
             VALUES ($1, 'прийнято') RETURNING *`,
            [newDevice.rows[0].id]
        );
        
        res.json(newOrder.rows[0]);
    } catch (err) {
        console.error('Помилка створення замовлення:', err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити статус замовлення
app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    
    try {
        const result = await pool.query(
            `UPDATE orders 
             SET status = $1, updated_at = CURRENT_TIMESTAMP,
                 completed_at = CASE WHEN $1 = 'виконано' THEN CURRENT_TIMESTAMP ELSE completed_at END
             WHERE id = $2 RETURNING *`,
            [status, orderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка оновлення статусу:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== МАРШРУТИ ДЛЯ ДЕТАЛЕЙ ==========

// Отримати всі деталі
app.get('/api/parts', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM spare_parts ORDER BY id'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання деталей:', err);
        res.status(500).json({ error: err.message });
    }
});

// Додати нову деталь
app.post('/api/parts', async (req, res) => {
    const { part_name, quantity, price, category, supplier } = req.body;
    
    try {
        const result = await pool.query(
            `INSERT INTO spare_parts (part_name, quantity, price, category, supplier) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [part_name, quantity || 0, price || 0, category || 'інше', supplier || '']
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка додавання деталі:', err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити кількість деталі
app.put('/api/parts/:id', async (req, res) => {
    const { quantity } = req.body;
    const partId = req.params.id;
    
    try {
        const result = await pool.query(
            'UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *',
            [quantity, partId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка оновлення деталі:', err);
        res.status(500).json({ error: err.message });
    }
});

// Використати деталь в ремонті
app.post('/api/orders/:id/parts', async (req, res) => {
    const orderId = req.params.id;
    const { partId, quantity } = req.body;
    
    try {
        // Отримуємо ціну деталі
        const part = await pool.query('SELECT price FROM spare_parts WHERE id = $1', [partId]);
        if (part.rows.length === 0) {
            return res.status(404).json({ error: 'Деталь не знайдено' });
        }
        
        const priceAtTime = part.rows[0].price;
        const totalPrice = priceAtTime * quantity;
        
        // Додаємо використання деталі
        await pool.query(
            `INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time, total_price) 
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, partId, quantity, priceAtTime, totalPrice]
        );
        
        // Зменшуємо кількість на складі
        await pool.query(
            'UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2',
            [quantity, partId]
        );
        
        // Оновлюємо total_cost в замовленні
        await pool.query(
            `UPDATE orders 
             SET total_cost = COALESCE(repair_cost, 0) + (
                 SELECT COALESCE(SUM(total_price), 0) 
                 FROM order_parts 
                 WHERE order_id = $1
             )
             WHERE id = $1`,
            [orderId]
        );
        
        res.json({ success: true, message: 'Деталь додано до замовлення' });
    } catch (err) {
        console.error('Помилка додавання деталі:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== SMS СПОВІЩЕННЯ (симуляція) ==========
app.post('/api/send-status-sms', async (req, res) => {
    const { phone, orderId, status, clientName } = req.body;
    
    console.log('='.repeat(50));
    console.log(`📱 SMS СПОВІЩЕННЯ`);
    console.log(`📞 Номер: ${phone}`);
    console.log(`👤 Клієнт: ${clientName}`);
    console.log(`🔢 Замовлення #${orderId}`);
    console.log(`📊 Новий статус: ${status}`);
    console.log('='.repeat(50));
    
    // Тут можна додати реальне SMS через Twilio
    res.json({ 
        success: true, 
        message: 'SMS відправлено (симуляція)',
        sms_text: `Шановний ${clientName}, ваше замовлення #${orderId} змінило статус на "${status}". Дякуємо що обираєте нас!`
    });
});

// ========== ЗВІТИ ==========

// Отримати звіт по використаним деталям
app.get('/api/reports/parts-usage', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sp.part_name,
                sp.category,
                COUNT(op.id) as times_used,
                SUM(op.quantity_used) as total_quantity,
                SUM(op.total_price) as total_cost
            FROM spare_parts sp
            LEFT JOIN order_parts op ON sp.id = op.part_id
            GROUP BY sp.id, sp.part_name, sp.category
            ORDER BY total_quantity DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика замовлень
app.get('/api/reports/orders-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_hours_in_status
            FROM orders
            GROUP BY status
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Тестовий маршрут
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Сервер працює!', 
        database: 'repair_workshop',
        timestamp: new Date().toISOString()
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n✅ СЕРВЕР ЗАПУЩЕНО на http://localhost:${PORT}`);
    console.log(`📋 Тест API: http://localhost:${PORT}/api/test`);
    console.log(`📦 Замовлення: http://localhost:${PORT}/api/orders`);
    console.log(`🔩 Деталі: http://localhost:${PORT}/api/parts\n`);
});