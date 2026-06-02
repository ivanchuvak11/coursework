const router = require('express').Router();
const pool = require('../database/pool');
const {
    isBlank,
    isPositiveInteger,
    validateNumber,
    sendValidationError,
} = require('../utils/validation');

module.exports = function createPartRoutes(authMiddleware) {
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM spare_parts ORDER BY id');
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка отримання деталей' });
        }
    });

    router.post('/', authMiddleware, async (req, res) => {
        const { part_name, quantity, price, category, supplier } = req.body;
        const normalizedQuantity = Number(quantity ?? 0);
        const normalizedPrice = Number(price ?? 0);
        const validationErrors = [
            isBlank(part_name) && 'Вкажіть назву деталі',
            validateNumber(normalizedQuantity, 'Кількість деталі', { min: 0, integer: true }),
            validateNumber(normalizedPrice, 'Ціна деталі'),
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const result = await pool.query(
                'INSERT INTO spare_parts (part_name, quantity, price, category, supplier) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [
                    String(part_name).trim(),
                    normalizedQuantity,
                    normalizedPrice,
                    isBlank(category) ? 'інше' : String(category).trim(),
                    isBlank(supplier) ? '' : String(supplier).trim(),
                ]
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка додавання деталі' });
        }
    });

    router.put('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { quantity } = req.body;
        const validationErrors = [
            !isPositiveInteger(id) && 'Некоректний номер деталі',
            validateNumber(quantity, 'Кількість деталі', { min: 0, integer: true }),
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const result = await pool.query(
                'UPDATE spare_parts SET quantity = $1 WHERE id = $2 RETURNING *',
                [Number(quantity), Number(id)]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Деталь не знайдена' });
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка оновлення деталі' });
        }
    });

    router.delete('/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return sendValidationError(res, ['Некоректний номер деталі']);
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const partResult = await client.query(
                'SELECT id FROM spare_parts WHERE id = $1 FOR UPDATE',
                [Number(id)]
            );

            if (partResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Деталь не знайдена' });
            }

            const usageResult = await client.query('DELETE FROM order_parts WHERE part_id = $1', [Number(id)]);
            await client.query('DELETE FROM spare_parts WHERE id = $1', [Number(id)]);

            await client.query('COMMIT');
            res.json({
                success: true,
                deletedPartId: Number(id),
                removedOrderLinks: usageResult.rowCount,
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Помилка видалення деталі:', err.message);
            res.status(500).json({ error: 'Помилка видалення деталі' });
        } finally {
            client.release();
        }
    });

    return router;
};
