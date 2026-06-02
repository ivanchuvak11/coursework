const router = require('express').Router();
const { sendEmail } = require('../services/emailService');
const { isBlank, isValidEmail } = require('../utils/validation');

module.exports = function createSystemRoutes(authMiddleware) {
    router.get('/test', (req, res) => {
        res.json({ message: 'Сервер працює!', email: process.env.EMAIL_USER ? '✅' : '❌' });
    });

    router.post('/test-email', authMiddleware, async (req, res) => {
        const { email } = req.body;
        if (!isValidEmail(email) || isBlank(email)) {
            return res.status(400).json({ error: 'Вкажіть коректний email' });
        }

        const result = await sendEmail(email, '🔧 Тест Смарт лайф', '<h2>Система працює!</h2>');
        res.json({ success: result });
    });

    return router;
};
