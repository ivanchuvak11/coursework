const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ========== ПІДКЛЮЧЕННЯ ДО POSTGRESQL ==========
const pool = new Pool({
  user: 'postgres',
  password: '1',      // ВАШ ПАРОЛЬ
  host: 'localhost',
  port: 5432,
  database: 'repair_workshop',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Перевірка підключення
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Помилка підключення до PostgreSQL:', err.message);
  } else {
    console.log('✅ Підключено до PostgreSQL (repair_workshop)');
    release();
  }
});

// ========== СЕКРЕТНИЙ КЛЮЧ ДЛЯ JWT ==========
const JWT_SECRET = 'repairmaster-secret-key-2024';

// ========== ДОПОМІЖНІ ФУНКЦІЇ ==========
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware для перевірки токена
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Немає токена авторизації' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Невірний або прострочений токен' });
  }

  // Перевіряємо чи існує користувач в БД
  const user = await pool.query('SELECT id, username, role FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
  if (user.rows.length === 0) {
    return res.status(401).json({ error: 'Користувача не знайдено' });
  }

  req.user = user.rows[0];
  next();
};

// Middleware для перевірки ролі
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизовано' });
    }
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Недостатньо прав' });
    }
  };
};

// ========== АВТОРИЗАЦІЯ ==========

// ЛОГІН (СПРОЩЕНА ВЕРСІЯ - ПРЯМЕ ПОРІВНЯННЯ)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('Спроба входу:', username);

  try {
    const result = await pool.query(
      'SELECT id, username, role, password_hash FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const user = result.rows[0];
    
    // ПРЯМЕ ПОРІВНЯННЯ паролів (без bcrypt)
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Помилка логіну:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Отримати поточного користувача
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Логаут
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  res.json({ success: true });
});

// ========== ЗАМОВЛЕННЯ ==========

// Отримати всі замовлення (з деталями клієнта та пристрою)
app.get('/api/orders', authMiddleware, async (req, res) => {
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
        d.device_type,
        d.brand,
        d.model,
        d.issue_description
      FROM orders o
      JOIN devices d ON o.device_id = d.id
      JOIN clients c ON d.client_id = c.id
      ORDER BY o.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка отримання замовлень' });
  }
});

// Створити нове замовлення
app.post('/api/orders', authMiddleware, async (req, res) => {
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
    'INSERT INTO orders (device_id, status, created_by) VALUES ($1, $2, $3) RETURNING *',
    [device.rows[0].id, 'прийнято', req.user.id]
  );

  res.json(order.rows[0]);
});

// Оновити статус замовлення
app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const result = await pool.query(
    `UPDATE orders 
     SET status = $1, updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN $1 = 'виконано' THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = $2 RETURNING *`,
    [status, orderId]
  );

  res.json(result.rows[0]);
});

// Додати деталь до замовлення
app.post('/api/orders/:id/parts', authMiddleware, async (req, res) => {
  const orderId = req.params.id;
  const { partId, quantity } = req.body;

  const part = await pool.query('SELECT price FROM spare_parts WHERE id = $1', [partId]);
  const priceAtTime = part.rows[0].price;

  await pool.query(
    'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
    [orderId, partId, quantity, priceAtTime]
  );

  await pool.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);

  res.json({ success: true });
});

// ========== ДЕТАЛІ (СКЛАД) ==========

// Отримати всі деталі
app.get('/api/parts', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM spare_parts ORDER BY id');
  res.json(result.rows);
});

// Додати нову деталь
app.post('/api/parts', authMiddleware, async (req, res) => {
  const { part_name, quantity, price, category, supplier } = req.body;

  const result = await pool.query(
    'INSERT INTO spare_parts (part_name, quantity, price, category, supplier) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [part_name, quantity || 0, price || 0, category || 'інше', supplier || '']
  );

  res.json(result.rows[0]);
});

// Оновити кількість деталі
app.put('/api/parts/:id', authMiddleware, async (req, res) => {
  const { quantity } = req.body;
  const partId = req.params.id;

  const result = await pool.query('UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *', [quantity, partId]);
  res.json(result.rows[0]);
});

// ========== SMS СПОВІЩЕННЯ (СИМУЛЯЦІЯ) ==========
app.post('/api/send-status-sms', authMiddleware, (req, res) => {
  const { phone, orderId, status, clientName } = req.body;
  console.log(`📱 SMS до ${phone}: Замовлення #${orderId} - статус змінено на "${status}"`);
  res.json({ success: true });
});

// ========== ТЕСТОВИЙ МАРШРУТ ==========
app.get('/api/test', (req, res) => {
  res.json({ message: 'Сервер працює з PostgreSQL!', time: new Date().toISOString() });
});

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущено на http://localhost:${PORT}`);
  console.log(`📡 API тест: http://localhost:${PORT}/api/test`);
  console.log(`🗄️  База даних: PostgreSQL (repair_workshop)\n`);
});