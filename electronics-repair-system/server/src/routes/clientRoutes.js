const router = require('express').Router();
const pool = require('../database/pool');
const { normalizeSmsPhone } = require('../services/smsService');
const { requireAnyRole } = require('../utils/accessControl');
const {
    isBlank,
    isPositiveInteger,
    isValidEmail,
    isValidPhone,
    sendValidationError,
} = require('../utils/validation');

module.exports = function createClientRoutes(authMiddleware) {
    router.put('/:id', authMiddleware, requireAnyRole('адмін', 'менеджер'), async (req, res) => {
        const { id } = req.params;
        const { phone, email } = req.body;
        const validationErrors = [
            !isPositiveInteger(id) && 'Некоректний номер клієнта',
            phone !== undefined && !isValidPhone(phone) && 'Вкажіть коректний телефон',
            email !== undefined && !isValidEmail(email) && 'Вкажіть коректний email',
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const updates = [];
            const values = [];

            if (phone !== undefined) {
                updates.push(`phone = $${values.length + 1}`);
                values.push(normalizeSmsPhone(phone));
            }
            if (email !== undefined) {
                updates.push(`email = $${values.length + 1}`);
                values.push(isBlank(email) ? null : String(email).trim());
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Немає даних' });
            }

            const query = `UPDATE clients SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
            values.push(Number(id));

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Клієнта не знайдено' });
            }

            res.json(result.rows[0]);
        } catch (err) {
            console.error('Помилка:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
