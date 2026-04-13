const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    password: 'your_password',
    host: 'localhost',
    port: 5432,
    database: 'repair_workshop'
});

module.exports = pool;