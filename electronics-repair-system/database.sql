-- database.sql
CREATE DATABASE repair_workshop;

-- Клієнти (захист даних)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Пристрої
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL, -- smartphone, laptop, tablet, etc.
    brand VARCHAR(50),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    issue_description TEXT
);

-- Замовлення з контролем стану
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id),
    status VARCHAR(30) DEFAULT 'прийнято',
    -- статуси: прийнято, діагностика, ремонт, виконано, видано
    diagnostic_report TEXT,
    repair_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Деталі (склад)
CREATE TABLE spare_parts (
    id SERIAL PRIMARY KEY,
    part_name VARCHAR(100) NOT NULL,
    compatible_models TEXT,
    quantity INTEGER DEFAULT 0,
    price DECIMAL(10, 2)
);

-- Використані деталі в ремонті
CREATE TABLE order_parts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    part_id INTEGER REFERENCES spare_parts(id),
    quantity_used INTEGER NOT NULL,
    total_price DECIMAL(10, 2)
);

-- Автоматичне оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();