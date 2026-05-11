const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== ПІДКЛЮЧЕННЯ ДО БД ==========
const pool = new Pool({
    user: 'postgres',
    password: '1',
    host: 'localhost',
    port: 5432,
    database: 'repair_workshop',
});

pool.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
`)
.then(res => console.log(res.rows))
.catch(err => console.log(err));

pool.query(`
  SELECT 
    current_database(),
    current_schema()
`)
.then(res => console.log(res.rows))
.catch(err => console.log(err));

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ ПОМИЛКА ПІДКЛЮЧЕННЯ ДО БД:');
        console.error('   Код:', err.code);
        console.error('   Повідомлення:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   ➜ PostgreSQL не запущений! Запустіть службу PostgreSQL.');
        } else if (err.code === '28P01') {
            console.error('   ➜ Невірний пароль! Перевірте password в налаштуваннях pool.');
        } else if (err.code === '3D000') {
            console.error('   ➜ База даних "repair_workshop" не існує! Створіть її в pgAdmin.');
        }
    } else {
        console.log('✅ ПІДКЛЮЧЕНО ДО POSTGRESQL!');
        release();
    }
});

// ========== EMAIL ==========
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

emailTransporter.verify((error) => {
    if (error) {
        console.error('❌ Помилка Gmail:', error);
    } else {
        console.log('✅ Gmail налаштовано');
    }
});

async function sendEmail(to, subject, htmlContent) {
    try {
        const info = await emailTransporter.sendMail({
            from: `"REPAIRMASTER" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log(`✅ Email відправлено: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Помилка email:', error.message);
        return false;
    }
}

// ========== JWT ==========
const JWT_SECRET = 'repairmaster-secret-key-2024';

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Немає токена' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Невірний токен' });
    }
};

// ========== АВТОРИЗАЦІЯ ==========
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, username, role FROM users WHERE username = $1 AND password_hash = $2',
            [username, password]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Невірний логін або пароль' });
        }
        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ success: true, token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json(req.user);
});

// ========== ЗАМОВЛЕННЯ (ВИПРАВЛЕНО) ==========
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                o.id, 
                o.status, 
                o.created_at,
                c.id as client_id,
                c.full_name, 
                c.phone, 
                c.email, 
                d.device_type, 
                d.brand, 
                d.model, 
                d.issue_description
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            ORDER BY o.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка /api/orders:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    const { clientName, clientPhone, clientEmail, deviceType, brand, model, issueDescription } = req.body;
    try {
        const clientResult = await pool.query(
            'INSERT INTO clients (full_name, phone, email) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET full_name = $1, email = $3 RETURNING id',
            [clientName, clientPhone, clientEmail || null]
        );
        const deviceResult = await pool.query(
            'INSERT INTO devices (client_id, device_type, brand, model, issue_description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [clientResult.rows[0].id, deviceType, brand, model, issueDescription]
        );
        const orderResult = await pool.query(
            'INSERT INTO orders (device_id, status) VALUES ($1, $2) RETURNING id',
            [deviceResult.rows[0].id, 'прийнято']
        );
        res.json({ id: orderResult.rows[0].id, status: 'прийнято', message: 'Замовлення створено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка створення замовлення' });
    }
});

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        // Отримуємо email клієнта
        const clientResult = await pool.query(`
            SELECT c.email, c.full_name, d.brand, d.model
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            WHERE o.id = $1
        `, [id]);

        const client = clientResult.rows[0];

        // Відправляємо email якщо є адреса
        if (client && client.email) {
            const statusText = {
                'прийнято': 'прийнято в роботу',
                'діагностика': 'на діагностиці',
                'ремонт': 'в ремонті',
                'виконано': 'виконано',
                'видано': 'видано клієнту'
            };

            const subject = status === 'виконано' 
                ? `✅ Замовлення #${id} виконано!`
                : `📋 Зміна статусу замовлення #${id}`;

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 500px;">
                    <div style="background: #4c5c96; color: white; padding: 15px; text-align: center;">
                        <h2>🔧 REPAIRMASTER</h2>
                    </div>
                    <div style="background: #f5f5f5; padding: 20px;">
                        <p>Шановний(а) <strong>${client.full_name}</strong>,</p>
                        ${status === 'виконано' ? `
                            <p>Ваше замовлення <strong>#${id}</strong> <strong style="color: #4caf50;">ВИКОНАНО</strong>!</p>
                            <p>Ви можете забрати пристрій у нашій майстерні.</p>
                        ` : `
                            <p>Статус вашого замовлення <strong>#${id}</strong> змінено на:</p>
                            <div style="background: #4c5c96; color: white; padding: 10px; text-align: center; border-radius: 5px;">
                                ${statusText[status] || status}
                            </div>
                        `}
                        <p><strong>Пристрій:</strong> ${client.brand || ''} ${client.model || ''}</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">Дякуємо, що обрали REPAIRMASTER!</p>
                    </div>
                </div>
            `;

            await sendEmail(client.email, subject, html);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка оновлення статусу' });
    }
});
// ========== ДЕТАЛІ ==========
app.get('/api/parts', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM spare_parts ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка отримання деталей' });
    }
});

app.post('/api/parts', authMiddleware, async (req, res) => {
    const { part_name, quantity, price, category, supplier } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO spare_parts (part_name, quantity, price, category, supplier) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [part_name, quantity || 0, price || 0, category || 'інше', supplier || '']
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка додавання деталі' });
    }
});

app.put('/api/parts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    try {
        const result = await pool.query('UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *', [quantity, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Деталь не знайдена' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка оновлення деталі' });
    }
});

app.post('/api/orders/:id/parts', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { partId, quantity } = req.body;
    try {
        const part = await pool.query('SELECT price FROM spare_parts WHERE id = $1', [partId]);
        if (part.rows.length === 0) return res.status(404).json({ error: 'Деталь не знайдена' });
        await pool.query(
            'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
            [id, partId, quantity, part.rows[0].price]
        );
        await pool.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка додавання деталі' });
    }
});

// ========== ОНОВЛЕННЯ КЛІЄНТА ==========
app.put('/api/clients/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { phone, email } = req.body;

    console.log(`Оновлення клієнта #${id}:`, { phone, email });

    try {
        const updates = [];
        const values = [];

        if (phone !== undefined) {
            updates.push(`phone = $${values.length + 1}`);
            values.push(phone);
        }
        if (email !== undefined) {
            updates.push(`email = $${values.length + 1}`);
            values.push(email);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Немає даних' });
        }

        const query = `UPDATE clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клієнта не знайдено' });
        }

        console.log('Оновлено:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== ТЕСТ ==========
app.get('/api/test', (req, res) => {
    res.json({ message: 'Сервер працює!', email: process.env.EMAIL_USER ? '✅' : '❌' });
});

app.post('/api/test-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Вкажіть email' });
    const result = await sendEmail(email, '🔧 Тест REPAIRMASTER', '<h2>Система працює!</h2>');
    res.json({ success: result });
});

// ========== ЗАПУСК ==========
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер на http://localhost:${PORT}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅' : '❌'}`);
    console.log(`📡 Тест: http://localhost:${PORT}/api/test\n`);
});