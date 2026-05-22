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

async function ensureOrderCompletionColumns() {
    try {
        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS repair_price NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS labor_price NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS completion_comment TEXT
        `);
    } catch (err) {
        console.error('❌ Не вдалося підготувати поля завершення ремонту:', err.message);
    }
}

ensureOrderCompletionColumns();

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
            from: `"Смарт лайф" <${process.env.EMAIL_USER}>`,
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
                o.repair_price,
                o.labor_price,
                o.completion_comment,
                c.id as client_id,
                c.full_name,
                c.phone,
                c.email,
                d.device_type,
                d.brand,
                d.model,
                d.issue_description,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'part_id', op.part_id,
                            'part_name', sp.part_name,
                            'quantity_used', op.quantity_used,
                            'price_at_time', op.price_at_time
                        )
                    ) FILTER (WHERE op.part_id IS NOT NULL),
                    '[]'
                ) AS used_parts
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            LEFT JOIN order_parts op ON op.order_id = o.id
            LEFT JOIN spare_parts sp ON sp.id = op.part_id
            GROUP BY o.id, c.id, d.id
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
        if (status === 'виконано') {
            return res.status(400).json({ error: 'Для статусу "Виконано" використовуйте завершення ремонту з ціною.' });
        }

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
                <div style="margin:0; padding:0; background:#eef8f6; font-family:Arial, 'Segoe UI', sans-serif; color:#10233f;">
                    <div style="max-width:640px; margin:0 auto; padding:28px 14px;">
                        <div style="background:linear-gradient(135deg,#0d9488,#2563eb); border-radius:18px 18px 0 0; padding:30px 28px; color:#ffffff;">
                            <div style="font-size:13px; letter-spacing:1.8px; text-transform:uppercase; opacity:.9;">Сервісний центр</div>
                            <h1 style="margin:8px 0 0; font-size:30px; line-height:1.15;">Смарт лайф</h1>
                            <p style="margin:10px 0 0; font-size:15px; opacity:.92;">Оновлення статусу вашого ремонту</p>
                        </div>

                        <div style="background:#ffffff; border:1px solid #cfe1e5; border-top:none; border-radius:0 0 18px 18px; padding:28px; box-shadow:0 18px 45px rgba(15,78,92,.12);">
                            <p style="margin:0 0 18px; font-size:16px;">Вітаємо, <strong>${client.full_name}</strong>.</p>
                            <p style="margin:0 0 20px; color:#63768c; font-size:15px; line-height:1.6;">
                                ${status === 'виконано'
                                    ? `Ваше замовлення <strong style="color:#10233f;">#${id}</strong> виконано. Пристрій готовий до видачі.`
                                    : `Статус замовлення <strong style="color:#10233f;">#${id}</strong> було змінено. Нижче актуальна інформація.`}
                            </p>

                            <div style="background:#f4fbfa; border:1px solid #d7ebe9; border-radius:14px; padding:18px; margin-bottom:18px;">
                                <div style="color:#63768c; font-size:13px; margin-bottom:8px;">Поточний статус</div>
                                <div style="background:${status === 'виконано' ? '#16a34a' : status === 'ремонт' ? '#f59e0b' : status === 'діагностика' ? '#2563eb' : '#0d9488'}; color:#ffffff; border-radius:999px; display:inline-block; font-size:16px; font-weight:700; padding:10px 18px;">
                                    ${statusText[status] || status}
                                </div>
                            </div>

                            <table style="width:100%; border-collapse:collapse; margin:0 0 22px;">
                                <tr>
                                    <td style="padding:12px 0; color:#63768c; border-bottom:1px solid #e3eef0;">Номер замовлення</td>
                                    <td style="padding:12px 0; text-align:right; font-weight:700; border-bottom:1px solid #e3eef0;">#${id}</td>
                                </tr>
                                <tr>
                                    <td style="padding:12px 0; color:#63768c; border-bottom:1px solid #e3eef0;">Пристрій</td>
                                    <td style="padding:12px 0; text-align:right; font-weight:700; border-bottom:1px solid #e3eef0;">${client.brand || ''} ${client.model || ''}</td>
                                </tr>
                                <tr>
                                    <td style="padding:12px 0; color:#63768c;">Що далі</td>
                                    <td style="padding:12px 0; text-align:right; font-weight:700;">
                                        ${status === 'виконано' ? 'Очікуємо вас для видачі' : 'Ми повідомимо про наступне оновлення'}
                                    </td>
                                </tr>
                            </table>

                            <div style="background:#10233f; border-radius:14px; color:#ffffff; padding:18px;">
                                <div style="font-weight:700; margin-bottom:6px;">Дякуємо, що обрали Смарт лайф</div>
                                <div style="color:#cbd7e8; font-size:13px; line-height:1.5;">Цей лист сформовано автоматично після зміни статусу замовлення.</div>
                            </div>
                        </div>
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

app.put('/api/orders/:id/complete', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { repairPrice, laborPrice, comment, usedParts = [] } = req.body;
    const client = await pool.connect();
    const normalizedLaborPrice = Number(laborPrice ?? repairPrice ?? 0) || 0;
    let partsTotal = 0;

    try {
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [id]);

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        await client.query(`
            UPDATE spare_parts AS sp
            SET quantity = sp.quantity + used_parts.quantity_used
            FROM (
                SELECT part_id, SUM(quantity_used)::integer AS quantity_used
                FROM order_parts
                WHERE order_id = $1
                GROUP BY part_id
            ) AS used_parts
            WHERE sp.id = used_parts.part_id
        `, [id]);

        await client.query('DELETE FROM order_parts WHERE order_id = $1', [id]);

        for (const usedPart of usedParts) {
            const partId = Number(usedPart.partId);
            const quantity = Number(usedPart.quantity);

            if (!partId || !quantity || quantity <= 0) continue;

            const partResult = await client.query(
                'SELECT id, part_name, quantity, price FROM spare_parts WHERE id = $1 FOR UPDATE',
                [partId]
            );

            if (partResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Обрану деталь не знайдено' });
            }

            const part = partResult.rows[0];

            if (Number(part.quantity) < quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Недостатньо на складі: ${part.part_name}` });
            }

            await client.query(
                'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
                [id, partId, quantity, part.price]
            );
            await client.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);
            partsTotal += Number(part.price || 0) * quantity;
        }

        const totalRepairPrice = normalizedLaborPrice + partsTotal;

        const updatedOrder = await client.query(
            `UPDATE orders
             SET status = 'виконано',
                 labor_price = $1,
                 repair_price = $2,
                 completion_comment = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, status, labor_price, repair_price, completion_comment`,
            [normalizedLaborPrice, totalRepairPrice, comment || null, id]
        );

        const usedPartsResult = await client.query(`
            SELECT op.part_id, sp.part_name, op.quantity_used, op.price_at_time
            FROM order_parts op
            JOIN spare_parts sp ON sp.id = op.part_id
            WHERE op.order_id = $1
            ORDER BY sp.part_name
        `, [id]);

        await client.query('COMMIT');

        try {
            const notificationResult = await pool.query(`
                SELECT c.email, c.full_name, d.brand, d.model
                FROM orders o
                JOIN devices d ON o.device_id = d.id
                JOIN clients c ON d.client_id = c.id
                WHERE o.id = $1
            `, [id]);
            const notificationClient = notificationResult.rows[0];

            if (notificationClient?.email) {
                await sendEmail(
                    notificationClient.email,
                    `✅ Замовлення #${id} виконано!`,
                    `
                        <div style="margin:0; padding:0; background:#eef8f6; font-family:Arial, 'Segoe UI', sans-serif; color:#10233f;">
                            <div style="max-width:640px; margin:0 auto; padding:28px 14px;">
                                <div style="background:linear-gradient(135deg,#0d9488,#2563eb); border-radius:18px 18px 0 0; padding:30px 28px; color:#ffffff;">
                                    <div style="font-size:13px; letter-spacing:1.8px; text-transform:uppercase; opacity:.9;">Смарт лайф</div>
                                    <h1 style="margin:8px 0 0; font-size:30px; line-height:1.15;">Ремонт виконано</h1>
                                </div>
                                <div style="background:#ffffff; border:1px solid #cfe1e5; border-top:none; border-radius:0 0 18px 18px; padding:28px;">
                                    <p style="margin:0 0 16px;">Вітаємо, <strong>${notificationClient.full_name}</strong>.</p>
                                    <p style="margin:0 0 18px; color:#63768c; line-height:1.6;">Ваше замовлення <strong>#${id}</strong> виконано. Пристрій готовий до видачі.</p>
                                    <div style="background:#f4fbfa; border:1px solid #d7ebe9; border-radius:14px; padding:18px;">
                                        <div style="color:#63768c; font-size:13px; margin-bottom:8px;">Пристрій</div>
                                        <strong>${notificationClient.brand || ''} ${notificationClient.model || ''}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                );
            }
        } catch (emailError) {
            console.error('Email про завершення не відправлено:', emailError.message);
        }

        res.json({
            ...updatedOrder.rows[0],
            used_parts: usedPartsResult.rows,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка завершення замовлення:', err.message);
        res.status(500).json({ error: 'Помилка завершення замовлення' });
    } finally {
        client.release();
    }
});

app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const orderResult = await client.query(
            'SELECT id, device_id FROM orders WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        const { device_id } = orderResult.rows[0];

        await client.query(`
            UPDATE spare_parts AS sp
            SET quantity = sp.quantity + used_parts.quantity_used
            FROM (
                SELECT part_id, SUM(quantity_used)::integer AS quantity_used
                FROM order_parts
                WHERE order_id = $1
                GROUP BY part_id
            ) AS used_parts
            WHERE sp.id = used_parts.part_id
        `, [id]);

        await client.query('DELETE FROM order_parts WHERE order_id = $1', [id]);
        await client.query('DELETE FROM orders WHERE id = $1', [id]);
        await client.query(`
            DELETE FROM devices
            WHERE id = $1
              AND NOT EXISTS (
                SELECT 1 FROM orders WHERE device_id = $1
              )
        `, [device_id]);

        await client.query('COMMIT');
        res.json({ success: true, deletedOrderId: Number(id) });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка видалення замовлення:', err.message);
        res.status(500).json({ error: 'Помилка видалення замовлення' });
    } finally {
        client.release();
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

app.delete('/api/parts/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const partResult = await client.query(
            'SELECT id, part_name FROM spare_parts WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (partResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Деталь не знайдена' });
        }

        const usageResult = await client.query('DELETE FROM order_parts WHERE part_id = $1', [id]);
        await client.query('DELETE FROM spare_parts WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({
            success: true,
            deletedPartId: Number(id),
            removedOrderLinks: usageResult.rowCount,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка видалення деталі:', err.message);
        res.status(500).json({ error: 'Помилка видалення деталі' });
    } finally {
        client.release();
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
