const databaseName = process.env.DB_NAME || 'repair_workshop';

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: databaseName,
};

module.exports = {
    databaseName,
    dbConfig,
};
