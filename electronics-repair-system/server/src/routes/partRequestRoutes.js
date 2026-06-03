const router = require('express').Router();
const pool = require('../database/pool');
const { isAdmin, isManager, isMaster, requireAnyRole } = require('../utils/accessControl');
const {
    isBlank,
    isPositiveInteger,
    sendValidationError,
    validateNumber,
} = require('../utils/validation');

const REQUEST_STATUSES = ['нове', 'замовлено', 'закрито'];

function canManagePartRequests(user) {
    return isAdmin(user) || isManager(user);
}

function buildPartRequestQuery(whereSql = '') {
    return `
        SELECT
            pr.id,
            pr.part_id,
            pr.requested_part_name,
            pr.requested_quantity,
            pr.comment,
            pr.status,
            pr.requested_by,
            pr.created_at,
            pr.handled_by,
            pr.handled_at,
            COALESCE(sp.part_name, pr.requested_part_name) AS part_name,
            sp.category,
            sp.quantity AS current_stock,
            sp.price
        FROM part_requests pr
        LEFT JOIN spare_parts sp ON sp.id = pr.part_id
        ${whereSql}
        ORDER BY
            CASE pr.status
                WHEN 'нове' THEN 0
                WHEN 'замовлено' THEN 1
                ELSE 2
            END,
            pr.created_at DESC
    `;
}

module.exports = function createPartRequestRoutes(authMiddleware) {
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const isManagerUser = canManagePartRequests(req.user);
            const result = await pool.query(
                buildPartRequestQuery(isManagerUser ? '' : 'WHERE pr.requested_by = $1'),
                isManagerUser ? [] : [req.user.username]
            );

            res.json(result.rows);
        } catch (err) {
            console.error('Помилка /api/part-requests:', err.message);
            res.status(500).json({ error: 'Помилка завантаження заявок на деталі' });
        }
    });

    router.post('/', authMiddleware, async (req, res) => {
        const { partId, partName, quantity, comment } = req.body;
        const hasKnownPart = isPositiveInteger(partId);
        const normalizedPartName = isBlank(partName) ? null : String(partName).trim();
        const validationErrors = [
            !isMaster(req.user) && 'Заявку на деталі може створити тільки майстер',
            !hasKnownPart && !normalizedPartName && 'Оберіть деталь або вкажіть назву потрібної деталі',
            validateNumber(quantity, 'Кількість деталей', { min: 1, integer: true }),
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            if (hasKnownPart) {
                const partResult = await pool.query(
                    'SELECT id FROM spare_parts WHERE id = $1',
                    [Number(partId)]
                );

                if (partResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Деталь не знайдено' });
                }
            }

            const createdResult = await pool.query(
                `INSERT INTO part_requests (part_id, requested_part_name, requested_quantity, comment, requested_by)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [
                    hasKnownPart ? Number(partId) : null,
                    hasKnownPart ? null : normalizedPartName,
                    Number(quantity),
                    comment ? String(comment).trim() : null,
                    req.user.username,
                ]
            );

            const result = await pool.query(
                buildPartRequestQuery('WHERE pr.id = $1'),
                [createdResult.rows[0].id]
            );

            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('Помилка створення заявки на деталі:', err.message);
            res.status(500).json({ error: 'Помилка створення заявки на деталі' });
        }
    });

    router.patch('/:id/status', authMiddleware, requireAnyRole('адмін', 'менеджер'), async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const validationErrors = [
            !isPositiveInteger(id) && 'Некоректний номер заявки',
            !REQUEST_STATUSES.includes(status) && 'Некоректний статус заявки',
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const handler = status === 'нове' ? null : req.user.username;
            const handledAtSql = status === 'нове' ? 'NULL' : 'NOW()';
            const updatedResult = await pool.query(
                `UPDATE part_requests
                 SET status = $1,
                     handled_by = $2,
                     handled_at = ${handledAtSql}
                 WHERE id = $3
                 RETURNING id`,
                [status, handler, Number(id)]
            );

            if (updatedResult.rows.length === 0) {
                return res.status(404).json({ error: 'Заявку не знайдено' });
            }

            const result = await pool.query(
                buildPartRequestQuery('WHERE pr.id = $1'),
                [updatedResult.rows[0].id]
            );

            res.json(result.rows[0]);
        } catch (err) {
            console.error('Помилка оновлення заявки на деталі:', err.message);
            res.status(500).json({ error: 'Помилка оновлення заявки на деталі' });
        }
    });

    return router;
};
