-- =====================================================
-- СИСТЕМА УПРАВЛІННЯ РЕМОНТНОЮ МАЙСТЕРНЕЮ ЕЛЕКТРОНІКИ
-- РОБОЧА БАЗА ДАНИХ
-- =====================================================

-- Видалити старі таблиці (якщо потрібно перестворити)
DROP TABLE IF EXISTS order_parts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS spare_parts CASCADE;
DROP TABLE IF EXISTS repair_history CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- =====================================================
-- 1. ТАБЛИЦЯ КЛІЄНТІВ (з захистом даних)
-- =====================================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    address TEXT,
    passport_number VARCHAR(20), -- для захисту даних
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Обмеження
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[0-9]{10,15}$'),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- 2. ТАБЛИЦЯ ПРИСТРОЇВ
-- =====================================================
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    brand VARCHAR(50),
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    imei VARCHAR(15), -- для смартфонів
    color VARCHAR(30),
    issue_description TEXT NOT NULL,
    client_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Обмеження
    CONSTRAINT valid_device_type CHECK (device_type IN ('smartphone', 'laptop', 'tablet', 'tv', 'console', 'other'))
);

-- =====================================================
-- 3. ТАБЛИЦЯ СПІВРОБІТНИКІВ
-- =====================================================
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    position VARCHAR(50) NOT NULL, -- майстер, менеджер, адмін
    phone VARCHAR(20) UNIQUE,
    hire_date DATE DEFAULT CURRENT_DATE,
    salary DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- 4. ТАБЛИЦЯ ЗАМОВЛЕНЬ (основна)
-- =====================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id),
    status VARCHAR(30) DEFAULT 'прийнято',
    priority VARCHAR(20) DEFAULT 'звичайний', -- звичайний, терміновий
    diagnostic_report TEXT,
    repair_cost DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    issued_at TIMESTAMP,
    -- Обмеження статусів
    CONSTRAINT valid_status CHECK (status IN ('прийнято', 'діагностика', 'очікує деталі', 'ремонт', 'тестування', 'виконано', 'видано', 'скасовано')),
    CONSTRAINT valid_priority CHECK (priority IN ('звичайний', 'терміновий')),
    CONSTRAINT valid_costs CHECK (repair_cost >= 0 AND total_cost >= 0)
);

-- =====================================================
-- 5. ТАБЛИЦЯ ЗАПАСНИХ ДЕТАЛЕЙ (склад)
-- =====================================================
CREATE TABLE spare_parts (
    id SERIAL PRIMARY KEY,
    part_name VARCHAR(150) NOT NULL,
    category VARCHAR(50), -- дисплей, акумулятор, плата, корпус, інше
    compatible_models TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 5, -- мінімальний залишок для замовлення
    price DECIMAL(10, 2) NOT NULL,
    supplier VARCHAR(100),
    location VARCHAR(50), -- місце зберігання
    last_restocked DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_quantity CHECK (quantity >= 0),
    CONSTRAINT valid_price CHECK (price >= 0)
);

-- =====================================================
-- 6. ТАБЛИЦЯ ВИКОРИСТАНИХ ДЕТАЛЕЙ (зв'язок замовлень і деталей)
-- =====================================================
CREATE TABLE order_parts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    part_id INTEGER NOT NULL REFERENCES spare_parts(id),
    quantity_used INTEGER NOT NULL,
    price_at_time DECIMAL(10, 2) NOT NULL, -- ціна на момент використання
    total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_used * price_at_time) STORED,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_quantity_used CHECK (quantity_used > 0)
);

-- =====================================================
-- 7. ТАБЛИЦЯ ПЛАТЕЖІВ
-- =====================================================
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'готівка', -- готівка, картка, безготівковий
    payment_status VARCHAR(30) DEFAULT 'очікує', -- очікує, оплачено, частково
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('готівка', 'картка', 'безготівковий'))
);

-- =====================================================
-- 8. ТАБЛИЦЯ ІСТОРІЇ РЕМОНТІВ (логування змін статусу)
-- =====================================================
CREATE TABLE repair_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by INTEGER REFERENCES employees(id),
    comment TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ТРИГЕРИ ТА ФУНКЦІЇ
-- =====================================================

-- Автоматичне оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spare_parts_updated_at BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Автоматичне оновлення total_cost в orders при додаванні деталей
CREATE OR REPLACE FUNCTION update_order_total_cost()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders 
    SET total_cost = COALESCE(repair_cost, 0) + (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM order_parts 
        WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_total_cost_after_insert
AFTER INSERT ON order_parts
FOR EACH ROW EXECUTE FUNCTION update_order_total_cost();

CREATE TRIGGER update_order_total_cost_after_delete
AFTER DELETE ON order_parts
FOR EACH ROW EXECUTE FUNCTION update_order_total_cost();

-- Автоматичне зменшення кількості деталей на складі
CREATE OR REPLACE FUNCTION decrease_part_quantity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE spare_parts 
    SET quantity = quantity - NEW.quantity_used
    WHERE id = NEW.part_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decrease_part_quantity_trigger
AFTER INSERT ON order_parts
FOR EACH ROW EXECUTE FUNCTION decrease_part_quantity();

-- Логування змін статусу
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO repair_history (order_id, old_status, new_status, changed_at)
        VALUES (NEW.id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_status_change_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- =====================================================
-- ІНДЕКСИ ДЛЯ ШВИДКОСТІ
-- =====================================================
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_devices_client_id ON devices(client_id);
CREATE INDEX idx_devices_serial ON devices(serial_number);
CREATE INDEX idx_orders_device_id ON orders(device_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_parts_order_id ON order_parts(order_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_repair_history_order_id ON repair_history(order_id);

-- =====================================================
-- ТЕСТОВІ ДАНІ (РЕАЛЬНІ ПРИКЛАДИ)
-- =====================================================

-- Клієнти
INSERT INTO clients (full_name, phone, email, address) VALUES
('Іван Петренко', '+380501234567', 'ivan@example.com', 'м. Київ, вул. Хрещатик, 15'),
('Марія Шевченко', '+380671234568', 'maria@example.com', 'м. Львів, вул. Личаківська, 45'),
('Олександр Коваленко', '+380931234569', 'olexandr@example.com', 'м. Одеса, вул. Дерибасівська, 10'),
('Наталія Бондаренко', '+380501234570', 'natalia@example.com', 'м. Харків, вул. Сумська, 23'),
('Дмитро Лисенко', '+380671234571', 'dmytro@example.com', 'м. Дніпро, вул. Центральна, 7');

-- Співробітники
INSERT INTO employees (full_name, position, phone, salary, is_active) VALUES
('Андрій Мельник', 'майстер', '+380501234500', 25000, true),
('Сергій Коваль', 'майстер', '+380671234501', 24000, true),
('Оксана Гнатенко', 'менеджер', '+380931234502', 18000, true),
('Володимир Ткаченко', 'адмін', '+380501234503', 20000, true);

-- Пристрої
INSERT INTO devices (client_id, device_type, brand, model, serial_number, imei, issue_description) VALUES
(1, 'smartphone', 'Apple', 'iPhone 13', 'SN123456789', '123456789012345', 'Не вмикається, не реагує на зарядку'),
(2, 'laptop', 'Dell', 'XPS 15', 'SN987654321', NULL, 'Проблеми з охолодженням, вимикається через 10 хвилин'),
(3, 'smartphone', 'Samsung', 'Galaxy S22', 'SN456789123', '987654321098765', 'Розбитий дисплей, не працює сенсор'),
(4, 'tablet', 'iPad', 'Air 4', 'SN789123456', NULL, 'Не заряджається, заміна порту'),
(5, 'smartphone', 'Xiaomi', 'Mi 11', 'SN321654987', '555555555555555', 'Не працює динамік, проблеми з мікрофоном');

-- Замовлення
INSERT INTO orders (device_id, employee_id, status, priority, diagnostic_report, repair_cost) VALUES
(1, 1, 'діагностика', 'терміновий', 'Попередній діагноз: проблема з контролером живлення', 500),
(2, 2, 'ремонт', 'звичайний', 'Діагностика: забиті радіатори, потрібна заміна термопасти', 800),
(3, 1, 'очікує деталі', 'терміновий', 'Потрібна заміна дисплея', 3500),
(4, 2, 'прийнято', 'звичайний', NULL, NULL),
(5, 1, 'тестування', 'звичайний', 'Замінено динамік та мікрофон, тестується', 1200);

-- Оновлення статусів (логуються автоматично)
UPDATE orders SET status = 'діагностика' WHERE id = 1;
UPDATE orders SET status = 'очікує деталі' WHERE id = 3;
UPDATE orders SET status = 'тестування' WHERE id = 5;

-- Запасні деталі
INSERT INTO spare_parts (part_name, category, quantity, min_quantity, price, supplier, location) VALUES
('Дисплей iPhone 13 OLED', 'дисплей', 5, 3, 3200, 'Apple Parts Inc', 'Стелаж A1'),
('Акумулятор iPhone 13', 'акумулятор', 8, 5, 850, 'Battery Pro', 'Стелаж B2'),
('Дисплей Samsung Galaxy S22', 'дисплей', 3, 3, 3500, 'Samsung Parts', 'Стелаж A2'),
('Термопаста Arctic MX-4', 'термоінтерфейс', 15, 5, 150, 'Cooling Shop', 'Стелаж C1'),
('Порт зарядки Type-C', 'розєм', 12, 5, 280, 'Connector Inc', 'Стелаж B1'),
('Динамік для Xiaomi Mi 11', 'динамік', 6, 3, 450, 'Audio Parts', 'Стелаж D1'),
('Мікрофон для Xiaomi Mi 11', 'мікрофон', 4, 3, 380, 'Audio Parts', 'Стелаж D2'),
('Радіатор для Dell XPS', 'охолодження', 3, 2, 650, 'Cooling Shop', 'Стелаж C2');

-- Використані деталі в ремонтах
INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES
(3, 3, 1, 3500),  -- Samsung дисплей для замовлення 3
(2, 4, 1, 150),   -- Термопаста для Dell
(5, 6, 1, 450),   -- Динамік для Xiaomi
(5, 7, 1, 380);   -- Мікрофон для Xiaomi

-- Платежі
INSERT INTO payments (order_id, amount, payment_method, payment_status) VALUES
(1, 500, 'готівка', 'оплачено'),
(3, 2000, 'картка', 'частково'),
(2, 800, 'готівка', 'оплачено');

-- =====================================================
-- ПЕРЕГЛЯД ДАНИХ
-- =====================================================

-- Всі замовлення з деталями клієнтів
CREATE OR REPLACE VIEW vw_orders_full AS
SELECT 
    o.id AS order_id,
    c.full_name AS client_name,
    c.phone AS client_phone,
    d.device_type,
    d.brand,
    d.model,
    d.serial_number,
    d.issue_description,
    o.status,
    o.priority,
    o.repair_cost,
    o.total_cost,
    e.full_name AS master_name,
    o.created_at,
    o.completed_at
FROM orders o
JOIN devices d ON o.device_id = d.id
JOIN clients c ON d.client_id = c.id
LEFT JOIN employees e ON o.employee_id = e.id
ORDER BY o.created_at DESC;

-- Звіт по використаним деталям
CREATE OR REPLACE VIEW vw_parts_usage_report AS
SELECT 
    p.part_name,
    p.category,
    COUNT(op.id) AS times_used,
    SUM(op.quantity_used) AS total_quantity_used,
    SUM(op.total_price) AS total_cost,
    p.quantity AS current_stock,
    p.min_quantity
FROM spare_parts p
LEFT JOIN order_parts op ON p.id = op.part_id
GROUP BY p.id
ORDER BY total_quantity_used DESC;

-- Фінансовий звіт
CREATE OR REPLACE VIEW vw_financial_report AS
SELECT 
    DATE_TRUNC('month', o.created_at) AS month,
    COUNT(o.id) AS total_orders,
    SUM(o.total_cost) AS total_revenue,
    SUM(p.amount) AS total_payments_received,
    COUNT(CASE WHEN o.status = 'виконано' THEN 1 END) AS completed_orders
FROM orders o
LEFT JOIN payments p ON o.id = p.order_id AND p.payment_status = 'оплачено'
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month DESC;

-- =====================================================
-- КОРИСНІ ЗАПИТИ ДЛЯ ЗВІТНОСТІ
-- =====================================================

-- 1. Замовлення, що потребують уваги (довго в одному статусі)
SELECT o.id, c.full_name, o.status, o.updated_at
FROM orders o
JOIN devices d ON o.device_id = d.id
JOIN clients c ON d.client_id = c.id
WHERE o.status NOT IN ('виконано', 'видано', 'скасовано')
AND o.updated_at < NOW() - INTERVAL '3 days'
ORDER BY o.updated_at;

-- 2. Топ-5 найпопулярніших деталей
SELECT part_name, SUM(quantity_used) as total_used
FROM order_parts op
JOIN spare_parts sp ON op.part_id = sp.id
GROUP BY part_name
ORDER BY total_used DESC
LIMIT 5;

-- 3. Статистика по майстрам
SELECT e.full_name, COUNT(o.id) as orders_completed
FROM employees e
JOIN orders o ON e.id = o.employee_id
WHERE o.status IN ('виконано', 'видано')
GROUP BY e.full_name
ORDER BY orders_completed DESC;

-- =====================================================
-- ДОДАЄМО ТАБЛИЦІ ДЛЯ АВТОРИЗАЦІЇ
-- =====================================================

-- Таблиця користувачів (працівників)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- хешований пароль
    employee_id INTEGER REFERENCES employees(id),
    role VARCHAR(30) DEFAULT 'майстер', -- адмін, менеджер, майстер
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('адмін', 'менеджер', 'майстер'))
);

-- Таблиця сесій (для JWT токенів)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Додаємо поле created_by в замовлення (хто створив)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Додаємо історію дій користувачів
CREATE TABLE IF NOT EXISTS user_actions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50), -- login, logout, create_order, update_status, etc.
    action_details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Додаємо тестових користувачів (пароль: 123456)
-- Пароль хешований за допомогою bcrypt (для прикладу)
INSERT INTO users (username, password_hash, employee_id, role) VALUES
('admin', '$2b$10$5f4v5Rq7Xq8Yq9Zr0s1tU2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0', NULL, 'адмін'),
('master1', '$2b$10$5f4v5Rq7Xq8Yq9Zr0s1tU2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0', 1, 'майстер'),
('manager1', '$2b$10$5f4v5Rq7Xq8Yq9Zr0s1tU2v3w4x5y6z7A8B9C0D1E2F3G4H5I6J7K8L9M0', 3, 'менеджер');

-- Оновлюємо співробітників (додаємо логіни)
UPDATE employees SET full_name = 'Адміністратор Системи' WHERE id = 1;
UPDATE employees SET full_name = 'Андрій Мельник (Майстер)' WHERE id = 1;
UPDATE employees SET full_name = 'Оксана Гнатенко (Менеджер)' WHERE id = 3;