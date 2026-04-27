const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ========== ПІДКЛЮЧЕННЯ ДО БАЗИ ДАНИХ ==========
const pool = new Pool({
  user: 'postgres',
  password: '1',     // ВАШ ПАРОЛЬ
  host: 'localhost',
  port: 5432,
  database: 'repair_workshop',
});

// Перевірка підключення
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Помилка підключення:', err.message);
  } else {
    console.log('✅ Підключено до PostgreSQL');
    release();
  }
});

// ========== НАЛАШТУВАННЯ JWT ==========
const JWT_SECRET = 'repairmaster-secret-key-2024';

// Middleware для перевірки токена
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Немає токена' });
  }

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
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ========== ЗАМОВЛЕННЯ ==========

// Отримати всі замовлення
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.status,
        o.repair_cost,
        o.total_cost,
        o.created_at,
        c.full_name,
        c.phone,
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
    console.error(err);
    res.status(500).json({ error: 'Помилка отримання замовлень' });
  }
});

// Створити нове замовлення
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;

  try {
    // Додаємо або оновлюємо клієнта
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
      'INSERT INTO orders (device_id, status) VALUES ($1, $2) RETURNING id',
      [deviceId, 'прийнято']
    );

    res.json({ 
      id: orderResult.rows[0].id, 
      status: 'прийнято',
      message: 'Замовлення створено'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка створення замовлення' });
  }
});

// Оновити статус замовлення
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка оновлення статусу' });
  }
});

// ========== ДЕТАЛІ (СКЛАД) ==========

// Отримати всі деталі
app.get('/api/parts', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM spare_parts ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка отримання деталей' });
  }
});

// Додати нову деталь
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

// Оновити кількість деталі
app.put('/api/parts/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  try {
    const result = await pool.query(
      'UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка оновлення деталі' });
  }
});

// Додати деталь до замовлення
app.post('/api/orders/:id/parts', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { partId, quantity } = req.body;

  try {
    const part = await pool.query('SELECT price FROM spare_parts WHERE id = $1', [partId]);
    if (part.rows.length === 0) {
      return res.status(404).json({ error: 'Деталь не знайдена' });
    }

    const priceAtTime = part.rows[0].price;

    await pool.query(
      'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
      [id, partId, quantity, priceAtTime]
    );

    await pool.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);

    res.json({ success: true, message: 'Деталь додано до замовлення' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка додавання деталі' });
  }
});

// ========== SMS СПОВІЩЕННЯ ==========
app.post('/api/send-status-sms', authMiddleware, (req, res) => {
  const { phone, orderId, status, clientName } = req.body;
  console.log(`📱 SMS до ${phone}: ${clientName}, ваше замовлення #${orderId} змінило статус на "${status}"`);
  res.json({ success: true });
});

// ========== ТЕСТОВИЙ МАРШРУТ ==========
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Сервер працює!', 
    database: 'PostgreSQL',
    status: 'OK'
  });
});

// Оновити кількість деталі
app.put('/api/parts/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  try {
    const result = await pool.query(
      'UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Деталь не знайдена' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка оновлення деталі' });
  }
});

// ========== ЗАПУСК ==========
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущено на http://localhost:${PORT}`);
  console.log(`📡 API тест: http://localhost:${PORT}/api/test`);
  console.log(`🗄️  База даних: PostgreSQL\n`);
});