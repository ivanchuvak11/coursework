const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = require('./pool');
const { databaseName, dbConfig } = require('../config/database');
const {
    DATABASE_SCHEMA_SQL,
    DEFAULT_MASTERS,
    DEFAULT_SPARE_PARTS,
    DEFAULT_USERS,
} = require('./schema');

function quoteIdentifier(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists() {
    if (String(process.env.DB_AUTO_CREATE || 'true').toLowerCase() === 'false') {
        return;
    }

    const adminPool = new Pool({
        ...dbConfig,
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
    });

    try {
        const result = await adminPool.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [databaseName]
        );

        if (result.rows.length === 0) {
            await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
            console.log(`✅ Створено базу даних ${databaseName}`);
        }
    } finally {
        await adminPool.end();
    }
}

async function verifyDatabaseConnection() {
    let client;

    try {
        client = await pool.connect();
        console.log('✅ Підключено до PostgreSQL');
    } catch (err) {
        console.error('❌ Помилка підключення до БД');
        console.error('   Код:', err.code);
        console.error('   Повідомлення:', err.message);

        if (err.code === 'ECONNREFUSED') {
            console.error('   ➜ PostgreSQL не запущений. Запустіть службу PostgreSQL.');
        } else if (err.code === '28P01') {
            console.error('   ➜ Невірний пароль. Перевірте DB_PASSWORD у server/.env.');
        } else if (err.code === '3D000') {
            console.error(`   ➜ База "${databaseName}" не існує або її не вдалося створити.`);
        }

        throw err;
    } finally {
        if (client) client.release();
    }
}

async function ensureBaseSchema() {
    await ensureDatabaseExists();
    await verifyDatabaseConnection();
    await pool.query(DATABASE_SCHEMA_SQL);
}

async function ensureDefaultMasters() {
    for (const master of DEFAULT_MASTERS) {
        await pool.query(`
            INSERT INTO masters (full_name, specialization, username)
            VALUES ($1, $2, $3)
            ON CONFLICT (full_name) DO UPDATE
            SET specialization = EXCLUDED.specialization,
                is_active = TRUE,
                username = COALESCE(masters.username, EXCLUDED.username)
        `, [master.fullName, master.specialization, master.username]);
    }
}

async function ensureDefaultSpareParts() {
    const countResult = await pool.query('SELECT COUNT(*)::integer AS count FROM spare_parts');
    if (countResult.rows[0].count > 0) return;

    for (const part of DEFAULT_SPARE_PARTS) {
        await pool.query(`
            INSERT INTO spare_parts (part_name, category, quantity, price, supplier)
            VALUES ($1, $2, $3, $4, $5)
        `, [part.partName, part.category, part.quantity, part.price, part.supplier || null]);
    }
}

async function ensureDefaultUsers() {
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '123456';

    for (const user of DEFAULT_USERS) {
        const existsResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [user.username]
        );

        if (existsResult.rows.length > 0) continue;

        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
            [user.username, passwordHash, user.role]
        );
    }
}

async function assignMissingOrderMasters() {
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
}

async function initializeDatabase() {
    try {
        await ensureBaseSchema();
        await ensureDefaultMasters();
        await ensureDefaultSpareParts();
        await ensureDefaultUsers();
        await assignMissingOrderMasters();
    } catch (err) {
        console.error('❌ База даних не готова:', err.message);
        throw err;
    }
}

module.exports = {
    initializeDatabase,
};
