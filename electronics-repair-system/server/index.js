const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ========== ТЕСТОВІ ДАНІ В ПАМ'ЯТІ ==========
let orders = [
    { 
        id: 1, 
        full_name: 'Іван Петренко', 
        phone: '+380501234567', 
        device_type: 'smartphone',
        brand: 'Apple',
        model: 'iPhone 13',
        status: 'прийнято',
        issue_description: 'Не вмикається',
        created_at: new Date().toISOString()
    },
    { 
        id: 2, 
        full_name: 'Марія Шевченко', 
        phone: '+380671234568', 
        device_type: 'laptop',
        brand: 'Dell',
        model: 'XPS 15',
        status: 'ремонт',
        issue_description: 'Перегрівається',
        created_at: new Date().toISOString()
    },
    { 
        id: 3, 
        full_name: 'Олександр Коваленко', 
        phone: '+380931234569', 
        device_type: 'smartphone',
        brand: 'Samsung',
        model: 'Galaxy S22',
        status: 'діагностика',
        issue_description: 'Розбитий екран',
        created_at: new Date().toISOString()
    }
];

let parts = [
    { id: 1, part_name: 'Дисплей iPhone 13', quantity: 5, price: 3200, category: 'дисплей' },
    { id: 2, part_name: 'Акумулятор Samsung', quantity: 8, price: 850, category: 'акумулятор' },
    { id: 3, part_name: 'Термопаста Arctic MX-4', quantity: 15, price: 150, category: 'термоінтерфейс' },
    { id: 4, part_name: 'Порт зарядки Type-C', quantity: 12, price: 280, category: 'роз\'єм' }
];

let nextOrderId = 4;
let nextPartId = 5;

// ========== ТЕСТОВІ КОРИСТУВАЧІ (ВСЕ В КОДІ, БЕЗ БД) ==========
const TEST_USERS = [
    { id: 1, username: 'admin', password: '123456', role: 'адмін' },
    { id: 2, username: 'master1', password: '123456', role: 'майстер' },
    { id: 3, username: 'manager1', password: '123456', role: 'менеджер' }
];

// Зберігаємо активні токени
let activeTokens = {};

// ========== АВТОРИЗАЦІЯ (ПРАЦЮЄ БЕЗ БД) ==========
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Спроба входу:', username);
    
    const user = TEST_USERS.find(u => u.username === username && u.password === password);
    
    if (!user) {
        console.log('❌ Невірний логін або пароль');
        return res.status(401).json({ error: 'Невірний логін або пароль' });
    }
    
    // Створюємо простий токен
    const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');
    activeTokens[token] = user.id;
    
    console.log('✅ Вхід успішний:', user.username, 'Роль:', user.role);
    
    res.json({
        success: true,
        token: token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

// Middleware для перевірки токена
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Немає токена' });
    }
    
    if (!activeTokens[token]) {
        return res.status(401).json({ error: 'Токен недійсний' });
    }
    
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [userId] = decoded.split(':');
        const user = TEST_USERS.find(u => u.id === parseInt(userId));
        
        if (!user) {
            return res.status(401).json({ error: 'Користувача не знайдено' });
        }
        
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Невірний токен' });
    }
};

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
    });
});

app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        delete activeTokens[token];
    }
    res.json({ success: true });
});

// ========== ЗАМОВЛЕННЯ ==========
app.get('/api/orders', authMiddleware, (req, res) => {
    res.json(orders);
});

app.post('/api/orders', authMiddleware, (req, res) => {
    const { clientName, clientPhone, deviceType, brand, model, issueDescription } = req.body;
    
    const newOrder = {
        id: nextOrderId++,
        full_name: clientName,
        phone: clientPhone,
        device_type: deviceType,
        brand: brand || '',
        model: model || '',
        status: 'прийнято',
        issue_description: issueDescription,
        created_at: new Date().toISOString(),
        created_by: req.user.username
    };
    orders.unshift(newOrder);
    console.log('📦 Створено замовлення #' + newOrder.id);
    res.json(newOrder);
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id);
    const order = orders.find(o => o.id === id);
    
    if (order) {
        order.status = req.body.status;
        console.log(`📊 Замовлення #${id}: статус змінено на "${order.status}" (${req.user.username})`);
        res.json(order);
    } else {
        res.status(404).json({ error: 'Замовлення не знайдено' });
    }
});

app.post('/api/orders/:id/parts', authMiddleware, (req, res) => {
    console.log(`🔩 Додано деталь до замовлення #${req.params.id} (${req.user.username})`);
    res.json({ success: true });
});

// ========== ДЕТАЛІ ==========
app.get('/api/parts', authMiddleware, (req, res) => {
    res.json(parts);
});

app.post('/api/parts', authMiddleware, (req, res) => {
    const { part_name, quantity, price, category } = req.body;
    
    const newPart = {
        id: nextPartId++,
        part_name: part_name,
        quantity: parseInt(quantity) || 0,
        price: parseFloat(price) || 0,
        category: category || 'інше'
    };
    parts.push(newPart);
    console.log('🔧 Додано деталь:', newPart.part_name);
    res.json(newPart);
});

app.put('/api/parts/:id', authMiddleware, (req, res) => {
    const id = parseInt(req.params.id);
    const part = parts.find(p => p.id === id);
    
    if (part) {
        part.quantity = req.body.quantity;
        res.json(part);
    } else {
        res.status(404).json({ error: 'Деталь не знайдено' });
    }
});

// ========== SMS СПОВІЩЕННЯ ==========
app.post('/api/send-status-sms', authMiddleware, (req, res) => {
    const { phone, orderId, status, clientName } = req.body;
    console.log('📱 SMS СПОВІЩЕННЯ:');
    console.log(`   📞 До: ${phone}`);
    console.log(`   👤 Клієнт: ${clientName}`);
    console.log(`   🔢 Замовлення #${orderId}`);
    console.log(`   📊 Статус: ${status}`);
    console.log(`   👨‍💼 Відправив: ${req.user.username}`);
    res.json({ success: true, message: 'SMS відправлено (симуляція)' });
});

// ========== СТАТИСТИКА ==========
app.get('/api/admin/stats', authMiddleware, (req, res) => {
    const stats = {
        total_orders: orders.length,
        completed_orders: orders.filter(o => o.status === 'виконано').length,
        total_parts: parts.length,
        total_revenue: 0,
        active_users: Object.keys(activeTokens).length
    };
    res.json(stats);
});

// ========== ТЕСТ ==========
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Сервер працює!', 
        mode: 'спрощений режим (без БД)',
        ordersCount: orders.length,
        partsCount: parts.length,
        availableUsers: TEST_USERS.map(u => ({ username: u.username, role: u.role }))
    });
});

// ========== ЗАПУСК ==========
const PORT = 5000;
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ СЕРВЕР ЗАПУЩЕНО!');
    console.log('='.repeat(50));
    console.log(`🌐 Адреса: http://localhost:${PORT}`);
    console.log(`📋 Тест: http://localhost:${PORT}/api/test`);
    console.log('\n📝 ТЕСТОВІ ОБЛІКОВІ ДАНІ:');
    console.log('   👑 Адмін:    admin / 123456');
    console.log('   🔧 Майстер:  master1 / 123456');
    console.log('   📋 Менеджер: manager1 / 123456');
    console.log('\n💡 Це спрощена версія без PostgreSQL');
    console.log('   Дані зберігаються в пам\'яті сервера');
    console.log('='.repeat(50) + '\n');
});