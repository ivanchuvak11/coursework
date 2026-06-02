const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
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
            ADD COLUMN IF NOT EXISTS completion_comment TEXT,
            ADD COLUMN IF NOT EXISTS assigned_master_id INTEGER
        `);
    } catch (err) {
        console.error('❌ Не вдалося підготувати поля завершення ремонту:', err.message);
    }
}

async function ensureMastersSchema() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS masters (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL UNIQUE,
                specialization VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            INSERT INTO masters (full_name, specialization)
            VALUES
                ('Андрій К.', 'Смартфони та планшети'),
                ('Олег Т.', 'Ноутбуки та ПК'),
                ('Петро І.', 'Ігрові консолі'),
                ('Марина С.', 'Діагностика електроніки')
            ON CONFLICT (full_name) DO NOTHING
        `);

        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'orders_assigned_master_id_fkey'
                ) THEN
                    ALTER TABLE orders
                    ADD CONSTRAINT orders_assigned_master_id_fkey
                    FOREIGN KEY (assigned_master_id)
                    REFERENCES masters(id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
        `);
    } catch (err) {
        console.error('❌ Не вдалося підготувати таблицю майстрів:', err.message);
    }
}

async function assignMissingOrderMasters() {
    try {
        await pool.query(`
            WITH target_orders AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) AS order_row
                FROM orders
                WHERE assigned_master_id IS NULL
            ),
            active_masters AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY RANDOM()) AS master_row,
                    COUNT(*) OVER () AS master_count
                FROM masters
                WHERE is_active = TRUE
            )
            UPDATE orders AS o
            SET assigned_master_id = active_masters.id
            FROM target_orders
            JOIN active_masters
              ON ((target_orders.order_row - 1) % active_masters.master_count) + 1 = active_masters.master_row
            WHERE o.id = target_orders.id
        `);
    } catch (err) {
        console.error('❌ Не вдалося призначити майстрів для існуючих замовлень:', err.message);
    }
}

async function ensureDatabaseSchema() {
    await ensureOrderCompletionColumns();
    await ensureMastersSchema();
    await assignMissingOrderMasters();
}

ensureDatabaseSchema();

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

// ========== SMS ==========
function createTwilioClient() {
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();

    if (!accountSid || !authToken) return null;

    if (!accountSid.startsWith('AC')) {
        console.error('SMS не налаштовано: TWILIO_ACCOUNT_SID має починатися з "AC". Перевірте Account SID у Twilio Console.');
        return null;
    }

    try {
        return twilio(accountSid, authToken);
    } catch (error) {
        console.error('SMS не налаштовано:', error.message);
        return null;
    }
}

const twilioClient = createTwilioClient();

function normalizeSmsPhone(phone) {
    const rawPhone = String(phone || '').trim();
    if (!rawPhone) return '';
    if (rawPhone.startsWith('+')) return `+${rawPhone.replace(/\D/g, '')}`;

    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('380')) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+38${digits}`;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    return `+${digits}`;
}

function buildOrderAcceptedSms({ orderId, device }) {
    const deviceText = device ? ` (${device})` : '';
    return `\u0421\u043c\u0430\u0440\u0442 \u043b\u0430\u0439\u0444: \u0432\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #${orderId}${deviceText} \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e. \u041c\u0438 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u0438\u043c\u043e, \u043a\u043e\u043b\u0438 \u0440\u0435\u043c\u043e\u043d\u0442 \u0431\u0443\u0434\u0435 \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e.`;
}

function buildOrderCompletedSms({ orderId, device, paymentAmount }) {
    const deviceText = device ? ` (${device})` : '';
    const paymentText = Number(paymentAmount || 0) > 0
        ? ` \u0414\u043e \u043e\u043f\u043b\u0430\u0442\u0438: ${formatEmailCurrency(paymentAmount)}.`
        : '';
    return `\u0421\u043c\u0430\u0440\u0442 \u043b\u0430\u0439\u0444: \u0440\u0435\u043c\u043e\u043d\u0442 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #${orderId}${deviceText} \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e.${paymentText} \u041c\u043e\u0436\u0435\u0442\u0435 \u0437\u0430\u0431\u0440\u0430\u0442\u0438 \u043f\u0440\u0438\u0441\u0442\u0440\u0456\u0439.`;
}

async function sendSms(to, message) {
    const normalizedPhone = normalizeSmsPhone(to);
    const sender = process.env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
        : { from: process.env.TWILIO_PHONE_NUMBER };

    if (!twilioClient || (!process.env.TWILIO_PHONE_NUMBER && !process.env.TWILIO_MESSAGING_SERVICE_SID)) {
        console.warn('SMS \u043d\u0435 \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e: \u043d\u0435 \u043d\u0430\u043b\u0430\u0448\u0442\u043e\u0432\u0430\u043d\u043e Twilio');
        return false;
    }

    if (!normalizedPhone) {
        console.warn('SMS \u043d\u0435 \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e: \u043d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043d\u043e\u043c\u0435\u0440');
        return false;
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            to: normalizedPhone,
            ...sender
        });
        console.log(`SMS \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('SMS \u043d\u0435 \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e:', error.message);
        return false;
    }
}

function escapeEmailHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function legacyUtf8Text(text) {
    return Buffer.from(text, 'utf8').toString('latin1');
}

function isRepairStatus(status, text) {
    return status === text || status === legacyUtf8Text(text);
}

function formatEmailCurrency(amount) {
    const value = Number(amount || 0);
    return `${value.toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} \u0433\u0440\u043d`;
}

function buildRepairEmailTemplate({
    clientName,
    orderId,
    device,
    statusLabel,
    statusColor = '#2563eb',
    title,
    message,
    nextStep,
    paymentAmount,
    isComplete = false
}) {
    const safeClientName = escapeEmailHtml(clientName || '\u043a\u043b\u0456\u0454\u043d\u0442\u0435');
    const safeDevice = escapeEmailHtml(device || '\u041d\u0435 \u0432\u043a\u0430\u0437\u0430\u043d\u043e');
    const safeStatus = escapeEmailHtml(statusLabel || '\u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043e');
    const safeTitle = escapeEmailHtml(title || '\u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0440\u0435\u043c\u043e\u043d\u0442\u0443');
    const safeNextStep = escapeEmailHtml(nextStep || '\u041c\u0438 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u0438\u043c\u043e \u043f\u0440\u043e \u043d\u0430\u0441\u0442\u0443\u043f\u043d\u0435 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f');
    const hasPayment = paymentAmount !== undefined && paymentAmount !== null && Number(paymentAmount) > 0;
    const safePaymentAmount = formatEmailCurrency(paymentAmount);

    return `
        <div style="margin:0; padding:0; background:#eef8f6; font-family:Arial, 'Segoe UI', sans-serif; color:#29405a;">
            <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
                \u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #${orderId} \u0432 \u0441\u0435\u0440\u0432\u0456\u0441\u043d\u043e\u043c\u0443 \u0446\u0435\u043d\u0442\u0440\u0456 \u0421\u043c\u0430\u0440\u0442 \u043b\u0430\u0439\u0444.
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; background:#eef8f6;">
                <tr>
                    <td align="center" style="padding:32px 12px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; max-width:660px;">
                            <tr>
                                <td style="background:#ffffff; border:1px solid #cfe1e5; border-bottom:none; border-radius:18px 18px 0 0; padding:0;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                                        <tr>
                                            <td style="padding:24px 28px 18px;">
                                                <div style="color:#0d9488; font-size:22px; line-height:1.1; font-weight:700;">\u0421\u043c\u0430\u0440\u0442</div>
                                                <div style="color:#10233f; font-size:15px; line-height:1.1; font-weight:600;">\u043b\u0430\u0439\u0444</div>
                                            </td>
                                            <td align="right" style="padding:26px 28px 18px;">
                                                <div style="display:inline-block; background:${isComplete ? '#dcfce7' : '#ccfbf1'}; color:${isComplete ? '#166534' : '#0d9488'}; border:1px solid ${isComplete ? '#86efac' : '#5eead4'}; border-radius:999px; padding:9px 14px; font-size:13px; font-weight:600;">
                                                    #${orderId}
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td style="background:#ffffff; border:1px solid #cfe1e5; border-top:none; border-radius:0 0 18px 18px; padding:0 28px 28px; box-shadow:0 12px 32px rgba(15, 78, 92, .08);">
                                    <div style="background:#e6f3f1; border:1px solid #cfe1e5; border-radius:14px; padding:22px; margin:0 0 20px;">
                                        <h2 style="margin:0 0 10px; color:#10233f; font-size:25px; line-height:1.25; font-weight:700;">${safeTitle}</h2>
                                        <p style="margin:0; color:#63768c; font-size:15px; line-height:1.65;">
                                            \u0412\u0456\u0442\u0430\u0454\u043c\u043e, <strong style="color:#10233f; font-weight:600;">${safeClientName}</strong>. ${message}
                                        </p>
                                    </div>

                                    ${hasPayment ? `
                                    <div style="background:#0d9488; border:1px solid #0f766e; border-radius:16px; padding:20px 22px; margin:0 0 18px;">
                                        <div style="color:#ccfbf1; font-size:13px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">\u0414\u043e \u043e\u043f\u043b\u0430\u0442\u0438</div>
                                        <div style="color:#ffffff; font-size:32px; line-height:1.1; font-weight:700;">${safePaymentAmount}</div>
                                    </div>
                                    ` : ''}

                                    <p style="margin:0 0 10px; color:#10233f; font-size:15px; font-weight:600;">
                                        \u0414\u0435\u0442\u0430\u043b\u0456 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f
                                    </p>

                                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; background:#ffffff; border:1px solid #cfe1e5; border-radius:14px; margin:0 0 20px;">
                                        <tr>
                                            <td style="padding:14px 16px; color:#63768c; font-size:14px; border-bottom:1px solid #e3eef0;">\u041f\u043e\u0442\u043e\u0447\u043d\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441</td>
                                            <td align="right" style="padding:14px 16px; border-bottom:1px solid #e3eef0;">
                                                <span style="display:inline-block; background:${statusColor}; color:#ffffff; border-radius:999px; padding:8px 14px; font-size:13px; font-weight:600;">${safeStatus}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 16px; color:#63768c; font-size:14px; border-bottom:1px solid #e3eef0;">\u041d\u043e\u043c\u0435\u0440 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f</td>
                                            <td align="right" style="padding:14px 16px; color:#10233f; font-size:14px; font-weight:600; border-bottom:1px solid #e3eef0;">#${orderId}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 16px; color:#63768c; font-size:14px; border-bottom:1px solid #e3eef0;">\u041f\u0440\u0438\u0441\u0442\u0440\u0456\u0439</td>
                                            <td align="right" style="padding:14px 16px; color:#10233f; font-size:14px; font-weight:600; border-bottom:1px solid #e3eef0;">${safeDevice}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 16px; color:#63768c; font-size:14px;">\u0429\u043e \u0434\u0430\u043b\u0456</td>
                                            <td align="right" style="padding:14px 16px; color:#10233f; font-size:14px; font-weight:600;">${safeNextStep}</td>
                                        </tr>
                                    </table>

                                    <div style="background:#ccfbf1; border:1px solid #5eead4; border-radius:12px; padding:16px 18px;">
                                        <div style="color:#10233f; font-size:15px; font-weight:600; margin-bottom:5px;">\u0414\u044f\u043a\u0443\u0454\u043c\u043e, \u0449\u043e \u043e\u0431\u0440\u0430\u043b\u0438 \u0421\u043c\u0430\u0440\u0442 \u043b\u0430\u0439\u0444</div>
                                        <div style="color:#63768c; font-size:13px; line-height:1.55;">\u0426\u0435\u0439 \u043b\u0438\u0441\u0442 \u0441\u0444\u043e\u0440\u043c\u043e\u0432\u0430\u043d\u043e \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u043e. \u042f\u043a\u0449\u043e \u043c\u0430\u0454\u0442\u0435 \u043f\u0438\u0442\u0430\u043d\u043d\u044f, \u0437\u0432\u0435\u0440\u043d\u0456\u0442\u044c\u0441\u044f \u0434\u043e \u0441\u0435\u0440\u0432\u0456\u0441\u043d\u043e\u0433\u043e \u0446\u0435\u043d\u0442\u0440\u0443.</div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
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
                o.assigned_master_id,
                m.full_name AS master_name,
                m.specialization AS master_specialization,
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
            LEFT JOIN masters m ON m.id = o.assigned_master_id
            LEFT JOIN order_parts op ON op.order_id = o.id
            LEFT JOIN spare_parts sp ON sp.id = op.part_id
            GROUP BY o.id, c.id, d.id, m.id, m.full_name, m.specialization
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
            `INSERT INTO orders (device_id, status, assigned_master_id)
             VALUES (
                $1,
                $2,
                (SELECT id FROM masters WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 1)
             )
             RETURNING id, status, assigned_master_id`,
            [deviceResult.rows[0].id, 'прийнято']
        );
        const masterFields = await getOrderMasterFields(orderResult.rows[0].id);
        const createdOrderId = orderResult.rows[0].id;
        const deviceText = `${brand || ''} ${model || ''}`.trim();

        if (clientPhone) {
            await sendSms(clientPhone, buildOrderAcceptedSms({
                orderId: createdOrderId,
                device: deviceText
            }));
        }

        res.json({
            ...orderResult.rows[0],
            ...masterFields,
            message: 'Замовлення створено',
        });
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

        const result = status === 'ремонт'
            ? await pool.query(
                `UPDATE orders
                 SET status = $1,
                     assigned_master_id = COALESCE(assigned_master_id, $2),
                     updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [status, await getRandomMasterId(), id]
            )
            : await pool.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                [status, id]
            );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено' });
        }

        // Отримуємо email клієнта
        const clientResult = await pool.query(`
            SELECT c.email, c.phone, c.full_name, d.brand, d.model, o.repair_price
            FROM orders o
            JOIN devices d ON o.device_id = d.id
            JOIN clients c ON d.client_id = c.id
            WHERE o.id = $1
        `, [id]);

        const client = clientResult.rows[0];

        // Відправляємо email якщо є адреса
        if (client && (client.email || client.phone)) {
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

            const isDoneStatus = isRepairStatus(status, '\u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e');
            const isRepairingStatus = isRepairStatus(status, '\u0440\u0435\u043c\u043e\u043d\u0442');
            const isDiagnosticStatus = isRepairStatus(status, '\u0434\u0456\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430');

            const deviceText = `${client.brand || ''} ${client.model || ''}`.trim();
            const statusLabel = isDoneStatus
                ? '\u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e'
                : isRepairingStatus
                    ? '\u0432 \u0440\u0435\u043c\u043e\u043d\u0442\u0456'
                    : isDiagnosticStatus
                        ? '\u043d\u0430 \u0434\u0456\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u0446\u0456'
                        : statusText[status] || status;

            if (client.email) {
                await sendEmail(client.email, subject, buildRepairEmailTemplate({
                    clientName: client.full_name,
                    orderId: id,
                    device: deviceText,
                    statusLabel,
                    statusColor: isDoneStatus ? '#16a34a' : isRepairingStatus ? '#f59e0b' : isDiagnosticStatus ? '#2563eb' : '#0d9488',
                    title: isDoneStatus ? '\u0420\u0435\u043c\u043e\u043d\u0442 \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e' : '\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043e',
                    message: isDoneStatus
                        ? `\u0412\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f <strong style="color:#0f172a;">#${id}</strong> \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e. \u041f\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0434\u043e \u0432\u0438\u0434\u0430\u0447\u0456.`
                        : `\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f <strong style="color:#0f172a;">#${id}</strong> \u0431\u0443\u043b\u043e \u0437\u043c\u0456\u043d\u0435\u043d\u043e.`,
                    nextStep: isDoneStatus ? '\u041e\u0447\u0456\u043a\u0443\u0454\u043c\u043e \u0432\u0430\u0441 \u0434\u043b\u044f \u0432\u0438\u0434\u0430\u0447\u0456' : '\u041c\u0438 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u0438\u043c\u043e \u043f\u0440\u043e \u043d\u0430\u0441\u0442\u0443\u043f\u043d\u0435 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f',
                    paymentAmount: client.repair_price,
                    isComplete: isDoneStatus
                }));
            }

        }

        const masterFields = await getOrderMasterFields(id);
        res.json({ ...result.rows[0], ...masterFields });
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
                 assigned_master_id = COALESCE(assigned_master_id, $4),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING id, status, labor_price, repair_price, completion_comment, assigned_master_id`,
            [normalizedLaborPrice, totalRepairPrice, comment || null, await getRandomMasterId(client), id]
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
                SELECT c.email, c.phone, c.full_name, d.brand, d.model
                FROM orders o
                JOIN devices d ON o.device_id = d.id
                JOIN clients c ON d.client_id = c.id
                WHERE o.id = $1
            `, [id]);
            const notificationClient = notificationResult.rows[0];

            if (notificationClient?.email || notificationClient?.phone) {
                const deviceText = `${notificationClient.brand || ''} ${notificationClient.model || ''}`.trim();
                const completeEmailHtml = buildRepairEmailTemplate({
                    clientName: notificationClient.full_name,
                    orderId: id,
                    device: deviceText,
                    statusLabel: '\u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e',
                    statusColor: '#16a34a',
                    title: '\u0420\u0435\u043c\u043e\u043d\u0442 \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e',
                    message: `\u0412\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f <strong style="color:#0f172a;">#${id}</strong> \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e. \u041f\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0434\u043e \u0432\u0438\u0434\u0430\u0447\u0456.`,
                    nextStep: '\u041e\u0447\u0456\u043a\u0443\u0454\u043c\u043e \u0432\u0430\u0441 \u0434\u043b\u044f \u0432\u0438\u0434\u0430\u0447\u0456',
                    paymentAmount: totalRepairPrice,
                    isComplete: true
                });

                if (notificationClient.email) {
                    await sendEmail(
                    notificationClient.email,
                    `✅ Замовлення #${id} виконано!`,
                    completeEmailHtml
                    );
                }

                if (notificationClient.phone) {
                    await sendSms(notificationClient.phone, buildOrderCompletedSms({
                        orderId: id,
                        device: deviceText,
                        paymentAmount: totalRepairPrice
                    }));
                }
            }
        } catch (emailError) {
            console.error('Email про завершення не відправлено:', emailError.message);
        }

        res.json({
            ...updatedOrder.rows[0],
            ...(await getOrderMasterFields(id, client)),
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

app.post('/api/send-status-sms', authMiddleware, async (req, res) => {
    const { phone, orderId, type, device, paymentAmount } = req.body;
    if (!phone) return res.status(400).json({ error: '\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u0442\u0435\u043b\u0435\u0444\u043e\u043d' });

    const message = type === 'completed'
        ? buildOrderCompletedSms({ orderId, device, paymentAmount })
        : buildOrderAcceptedSms({ orderId, device });
    const success = await sendSms(phone, message);

    res.json({ success });
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

app.post('/api/test-sms', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: '\u0412\u043a\u0430\u0436\u0456\u0442\u044c \u0442\u0435\u043b\u0435\u0444\u043e\u043d' });
    const result = await sendSms(phone, buildOrderAcceptedSms({
        orderId: 1,
        device: 'test'
    }));
    res.json({ success: result });
});

// ========== ЗАПУСК ==========
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер на http://localhost:${PORT}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅' : '❌'}`);
    console.log(`SMS: ${twilioClient ? '✅' : '❌'}`);
    console.log(`📡 Тест: http://localhost:${PORT}/api/test\n`);
});
