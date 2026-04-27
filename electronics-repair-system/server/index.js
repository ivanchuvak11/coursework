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

// ========== НАЛАШТУВАННЯ EMAIL ==========
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Перевірка підключення
emailTransporter.verify((error, success) => {
    if (error) {
        console.error('❌ Помилка Gmail:', error);
    } else {
        console.log('✅ Gmail налаштовано');
    }
});

// Функція відправки email
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

// ========== JWT НАЛАШТУВАННЯ ==========
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
            'SELECT id, username, role FROM users WHERE username = $1 AND password_hash = $2 AND is_active = true',
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
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json(req.user);
});

// ========== ЗАМОВЛЕННЯ ==========
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.id, o.status, o.repair_cost, o.total_cost, o.created_at,
                   c.full_name, c.phone, c.email, d.device_type, d.brand, d.model, d.issue_description
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            ORDER BY o.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка отримання замовлень' });
    }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;
    try {
        const clientResult = await pool.query(
            'INSERT INTO clients (full_name, phone) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET full_name = $1 RETURNING id',
            [clientName, clientPhone]
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

// ОНОВЛЕННЯ СТАТУСУ З EMAIL СПОВІЩЕННЯМ
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

        // Отримуємо дані клієнта
        const clientResult = await pool.query(`
            SELECT c.full_name, c.email, d.brand, d.model
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            WHERE o.id = $1
        `, [id]);

        const client = clientResult.rows[0];

        // Відправляємо email якщо є адреса
        if (client && client.email) {
            const isCompleted = status === 'виконано';
            const statusText = {
                'прийнято': 'прийнято в роботу',
                'діагностика': 'на діагностиці',
                'ремонт': 'в ремонті',
                'виконано': 'виконано',
                'видано': 'видано клієнту'
            };

            const subject = isCompleted 
                ? `✅ Замовлення #${id} виконано!`
                : `📋 Зміна статусу замовлення #${id}`;

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 500px;">
                    <div style="background: #4c5c96; color: white; padding: 15px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h2>🔧 REPAIRMASTER</h2>
                    </div>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 10px 10px;">
                        <p>Шановний(а) <strong>${client.full_name}</strong>,</p>
                        ${isCompleted ? `
                            <p>Ваше замовлення <strong>#${id}</strong> <strong style="color: #4caf50;">ВИКОНАНО</strong>!</p>
                            <p>Ви можете забрати пристрій у нашій майстерні.</p>
                            <div style="background: #4caf50; color: white; padding: 10px; text-align: center; border-radius: 5px; margin: 15px 0;">
                                ✅ РЕМОНТ ЗАВЕРШЕНО
                            </div>
                        ` : `
                            <p>Статус вашого замовлення <strong>#${id}</strong> змінено на:</p>
                            <div style="background: #4c5c96; color: white; padding: 10px; text-align: center; border-radius: 5px; margin: 15px 0;">
                                ${statusText[status] || status}
                            </div>
                        `}
                        <p><strong>Пристрій:</strong> ${client.brand || ''} ${client.model || ''}</p>
                        <hr style="margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">Дякуємо, що обрали REPAIRMASTER!</p>
                    </div>
                </div>
            `;

            await sendEmail(client.email, subject, html);
        } else {
            console.log(`⚠️ У клієнта ${client?.full_name} немає email, сповіщення не відправлено`);
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
        res.json({ success: true, message: 'Деталь додано' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка додавання деталі' });
    }
});

// ========== ТЕСТ EMAIL ==========
app.post('/api/test-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Вкажіть email' });
    const result = await sendEmail(email, '🔧 Тест REPAIRMASTER', '<h2>Система працює!</h2><p>Email сповіщення налаштовані правильно.</p>');
    res.json({ success: result, message: result ? 'Email відправлено' : 'Помилка' });
});

// ========== ТЕСТ ==========
app.get('/api/test', (req, res) => {
    res.json({ message: 'Сервер працює!', email: process.env.EMAIL_USER ? '✅' : '❌' });
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    const { clientName, clientPhone, clientEmail, deviceType, brand, model, issueDescription } = req.body;
    
    // Додаємо email при створенні клієнта
    const clientResult = await pool.query(
        'INSERT INTO clients (full_name, phone, email) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET full_name = $1, email = $3 RETURNING id',
        [clientName, clientPhone, clientEmail]
    );
    // ...
});

// ========== ЗАПУСК ==========
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер на http://localhost:${PORT}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅ Gmail налаштовано' : '❌ Додайте EMAIL_USER/.env'}`);
    console.log(`📡 Тест email: POST /api/test-email з { "email": "your@email.com" }\n`);
});