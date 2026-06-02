const DATABASE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    device_type VARCHAR(50),
    brand VARCHAR(50),
    model VARCHAR(100),
    issue_description TEXT
);

CREATE TABLE IF NOT EXISTS masters (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL UNIQUE,
    specialization VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(100) UNIQUE
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'прийнято',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    repair_price NUMERIC(10, 2) DEFAULT 0,
    completion_comment TEXT,
    labor_price NUMERIC(10, 2) DEFAULT 0,
    assigned_master_id INTEGER REFERENCES masters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS spare_parts (
    id SERIAL PRIMARY KEY,
    part_name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    quantity INTEGER DEFAULT 0,
    price NUMERIC(10, 2) DEFAULT 0,
    supplier VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS order_parts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES spare_parts(id),
    quantity_used INTEGER DEFAULT 1,
    price_at_time NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'майстер'
);

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS repair_price NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS labor_price NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completion_comment TEXT,
    ADD COLUMN IF NOT EXISTS assigned_master_id INTEGER;

ALTER TABLE masters
    ADD COLUMN IF NOT EXISTS username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_phone_key'
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT clients_phone_key UNIQUE (phone);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'masters_username_key'
    ) THEN
        ALTER TABLE masters ADD CONSTRAINT masters_username_key UNIQUE (username);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'masters_full_name_key'
    ) THEN
        ALTER TABLE masters ADD CONSTRAINT masters_full_name_key UNIQUE (full_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_client_id_fkey'
    ) THEN
        ALTER TABLE devices
        ADD CONSTRAINT devices_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_device_id_fkey'
    ) THEN
        ALTER TABLE orders
        ADD CONSTRAINT orders_device_id_fkey
        FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_assigned_master_id_fkey'
    ) THEN
        ALTER TABLE orders
        ADD CONSTRAINT orders_assigned_master_id_fkey
        FOREIGN KEY (assigned_master_id)
        REFERENCES masters(id)
        ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_parts_order_id_fkey'
    ) THEN
        ALTER TABLE order_parts
        ADD CONSTRAINT order_parts_order_id_fkey
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_parts_part_id_fkey'
    ) THEN
        ALTER TABLE order_parts
        ADD CONSTRAINT order_parts_part_id_fkey
        FOREIGN KEY (part_id)
        REFERENCES spare_parts(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON devices(client_id);
CREATE INDEX IF NOT EXISTS idx_order_parts_order_id ON order_parts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_parts_part_id ON order_parts(part_id);
`;

const DEFAULT_MASTERS = [
    { fullName: 'Андрій К.', specialization: 'Смартфони та планшети', username: 'master1' },
    { fullName: 'Олег Т.', specialization: 'Ноутбуки та ПК', username: 'master2' },
    { fullName: 'Петро І.', specialization: 'Ігрові консолі', username: 'master3' },
];

const DEFAULT_SPARE_PARTS = [
    { partName: 'Дисплей iPhone 13', category: 'дисплей', quantity: 10, price: 3200 },
    { partName: 'Акумулятор Samsung', category: 'акумулятор', quantity: 5, price: 850 },
    { partName: 'Дисплей Samsung Galaxy S22', category: 'дисплей', quantity: 2, price: 3500 },
    { partName: 'Термопаста Arctic MX-4', category: 'термоінтерфейс', quantity: 20, price: 150 },
    { partName: 'Порт зарядки Type-C', category: 'розʼєм', quantity: 10, price: 280 },
    { partName: 'Динамік для Xiaomi', category: 'динамік', quantity: 3, price: 450 },
    { partName: 'Мікрофон', category: 'мікрофон', quantity: 3, price: 380 },
];

const DEFAULT_USERS = [
    { username: 'admin', role: 'адмін' },
    { username: 'master1', role: 'майстер' },
    { username: 'master2', role: 'майстер' },
    { username: 'master3', role: 'майстер' },
    { username: 'manager1', role: 'менеджер' },
];

module.exports = {
    DATABASE_SCHEMA_SQL,
    DEFAULT_MASTERS,
    DEFAULT_SPARE_PARTS,
    DEFAULT_USERS,
};
