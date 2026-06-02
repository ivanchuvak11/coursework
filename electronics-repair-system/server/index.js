require('dotenv').config();

const { createApp } = require('./src/app');
const { initializeDatabase } = require('./src/database/bootstrap');
const { isEmailConfigured, verifyEmailTransport } = require('./src/services/emailService');
const { isSmsConfigured } = require('./src/services/smsService');

const PORT = Number(process.env.PORT || 5000);
const app = createApp();

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`\n🚀 Сервер на http://localhost:${PORT}`);
            console.log(`📧 Email: ${isEmailConfigured() ? '✅' : '❌'}`);
            console.log(`SMS: ${isSmsConfigured() ? '✅' : '❌'}`);
            console.log(`📡 Тест: http://localhost:${PORT}/api/test\n`);
            verifyEmailTransport();
        });
    })
    .catch((err) => {
        console.error('❌ Сервер не запущено через помилку бази даних:', err.message);
        process.exitCode = 1;
    });
