const router = require('express').Router();
const pool = require('../database/pool');
const {
    buildRepairEmailTemplate,
    sendEmail,
} = require('../services/emailService');
const {
    buildOrderAcceptedSms,
    buildOrderCompletedSms,
    normalizeSmsPhone,
    sendSms,
} = require('../services/smsService');
const {
    getOrderMasterFields,
    getRandomMasterId,
} = require('../services/masterService');
const { ORDER_STATUSES, isRepairStatus } = require('../utils/repairStatus');
const { canSeeAllOrders, requireAnyRole } = require('../utils/accessControl');
const {
    isBlank,
    isPositiveInteger,
    isValidEmail,
    isValidPhone,
    sendValidationError,
    validateNumber,
} = require('../utils/validation');

function getDeviceText(orderLike) {
    return `${orderLike.brand || ''} ${orderLike.model || ''}`.trim();
}

function getOrderListAccess(user) {
    if (canSeeAllOrders(user)) {
        return { whereSql: '', params: [] };
    }

    return {
        whereSql: 'WHERE m.username = $1',
        params: [user.username],
    };
}

async function userCanAccessOrder(user, orderId, client = pool) {
    if (canSeeAllOrders(user)) {
        return true;
    }

    const result = await client.query(`
        SELECT 1
        FROM orders o
        JOIN masters m ON m.id = o.assigned_master_id
        WHERE o.id = $1
          AND m.username = $2
    `, [Number(orderId), user?.username]);

    return result.rows.length > 0;
}

async function requireOrderAccess(req, res, orderId, client = pool) {
    if (await userCanAccessOrder(req.user, orderId, client)) {
        return true;
    }

    res.status(403).json({ error: 'Недостатньо прав для цього замовлення' });
    return false;
}

async function recordStatusHistory(orderId, oldStatus, newStatus, changedBy, client = pool) {
    if (oldStatus === newStatus) return;

    await client.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [Number(orderId), oldStatus || null, newStatus, changedBy || null]
    );
}

async function getStatusHistory(orderId, client = pool) {
    const result = await client.query(`
        SELECT id, old_status, new_status, changed_by, changed_at
        FROM order_status_history
        WHERE order_id = $1
        ORDER BY changed_at DESC, id DESC
    `, [Number(orderId)]);

    return result.rows;
}

async function sendStatusEmail(orderId, status, client) {
    if (!client?.email) return;

    const isRepairingStatus = isRepairStatus(status, 'ремонт');
    const isDiagnosticStatus = isRepairStatus(status, 'діагностика');
    const statusText = {
        прийнято: 'прийнято в роботу',
        діагностика: 'на діагностиці',
        ремонт: 'в ремонті',
        видано: 'видано клієнту',
    };
    const statusLabel = isRepairingStatus
        ? 'в ремонті'
        : isDiagnosticStatus
            ? 'на діагностиці'
            : statusText[status] || status;

    await sendEmail(client.email, `Зміна статусу замовлення #${orderId}`, buildRepairEmailTemplate({
        clientName: client.full_name,
        orderId,
        device: getDeviceText(client),
        statusLabel,
        statusColor: isRepairingStatus ? '#f59e0b' : isDiagnosticStatus ? '#2563eb' : '#0d9488',
        title: 'Статус замовлення оновлено',
        message: `Статус замовлення <strong style="color:#0f172a;">#${orderId}</strong> було змінено.`,
        nextStep: 'Ми повідомимо про наступне оновлення',
        paymentAmount: client.repair_price,
        isComplete: false,
    }));
}

async function sendCompletionNotifications(orderId, totalRepairPrice) {
    const notificationResult = await pool.query(`
        SELECT c.email, c.phone, c.full_name, d.brand, d.model
        FROM orders o
        JOIN devices d ON o.device_id = d.id
        JOIN clients c ON d.client_id = c.id
        WHERE o.id = $1
    `, [orderId]);
    const notificationClient = notificationResult.rows[0];

    if (!notificationClient?.email && !notificationClient?.phone) return;

    const deviceText = getDeviceText(notificationClient);
    const completeEmailHtml = buildRepairEmailTemplate({
        clientName: notificationClient.full_name,
        orderId,
        device: deviceText,
        statusLabel: 'виконано',
        statusColor: '#16a34a',
        title: 'Ремонт виконано',
        message: `Ваше замовлення <strong style="color:#0f172a;">#${orderId}</strong> виконано. Пристрій готовий до видачі.`,
        nextStep: 'Очікуємо вас для видачі',
        paymentAmount: totalRepairPrice,
        isComplete: true,
    });

    if (notificationClient.email) {
        await sendEmail(
            notificationClient.email,
            `Замовлення #${orderId} виконано`,
            completeEmailHtml
        );
    }

    if (notificationClient.phone) {
        await sendSms(notificationClient.phone, buildOrderCompletedSms({
            orderId,
            device: deviceText,
            paymentAmount: totalRepairPrice,
        }));
    }
}

module.exports = function createOrderRoutes(authMiddleware) {
    router.get('/', authMiddleware, async (req, res) => {
        try {
            const access = getOrderListAccess(req.user);
            const result = await pool.query(`
                SELECT
                    o.id,
                    o.status,
                    o.created_at,
                    o.repair_price,
                    o.labor_price,
                    o.completion_comment,
                    o.assigned_master_id,
                    m.full_name AS master_name,
                    c.id as client_id,
                    c.full_name,
                    c.phone,
                    c.email,
                    d.device_type,
                    d.brand,
                    d.model,
                    d.issue_description,
                    COALESCE((
                        SELECT json_agg(
                            json_build_object(
                                'id', osh.id,
                                'old_status', osh.old_status,
                                'new_status', osh.new_status,
                                'changed_by', osh.changed_by,
                                'changed_at', osh.changed_at
                            )
                            ORDER BY osh.changed_at DESC
                        )
                        FROM order_status_history osh
                        WHERE osh.order_id = o.id
                    ), '[]') AS status_history,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'part_id', op.part_id,
                                'part_name', sp.part_name,
                                'quantity_used', op.quantity_used,
                                'price_at_time', op.price_at_time
                            )
                        ) FILTER (WHERE op.part_id IS NOT NULL),
                        '[]'
                    ) AS used_parts
                FROM orders o
                JOIN devices d ON o.device_id = d.id
                JOIN clients c ON d.client_id = c.id
                LEFT JOIN masters m ON m.id = o.assigned_master_id
                LEFT JOIN order_parts op ON op.order_id = o.id
                LEFT JOIN spare_parts sp ON sp.id = op.part_id
                ${access.whereSql}
                GROUP BY o.id, c.id, d.id, m.id, m.full_name
                ORDER BY o.id DESC
            `, access.params);
            res.json(result.rows);
        } catch (err) {
            console.error('Помилка /api/orders:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', authMiddleware, requireAnyRole('адмін', 'менеджер'), async (req, res) => {
        const { clientName, clientPhone, clientEmail, deviceType, brand, model, issueDescription } = req.body;
        const validationErrors = [
            isBlank(clientName) && 'Вкажіть ПІБ клієнта',
            (!clientPhone || !isValidPhone(clientPhone)) && 'Вкажіть коректний телефон',
            !isValidEmail(clientEmail) && 'Вкажіть коректний email',
            isBlank(deviceType) && 'Вкажіть тип пристрою',
            isBlank(brand) && 'Вкажіть бренд',
            isBlank(model) && 'Вкажіть модель',
            isBlank(issueDescription) && 'Опишіть несправність',
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const clientResult = await pool.query(
                'INSERT INTO clients (full_name, phone, email) VALUES ($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET full_name = $1, email = $3 RETURNING id',
                [String(clientName).trim(), normalizeSmsPhone(clientPhone), isBlank(clientEmail) ? null : String(clientEmail).trim()]
            );
            const deviceResult = await pool.query(
                'INSERT INTO devices (client_id, device_type, brand, model, issue_description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [clientResult.rows[0].id, String(deviceType).trim(), String(brand).trim(), String(model).trim(), String(issueDescription).trim()]
            );
            const orderResult = await pool.query(
                `INSERT INTO orders (device_id, status, assigned_master_id)
                 VALUES (
                    $1,
                    $2,
                    (SELECT id FROM masters WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 1)
                 )
                 RETURNING id, status, assigned_master_id`,
                [deviceResult.rows[0].id, 'прийнято']
            );
            const masterFields = await getOrderMasterFields(orderResult.rows[0].id);
            const createdOrderId = orderResult.rows[0].id;
            const deviceText = `${brand || ''} ${model || ''}`.trim();

            await recordStatusHistory(createdOrderId, null, orderResult.rows[0].status, req.user.username);

            await sendSms(clientPhone, buildOrderAcceptedSms({
                orderId: createdOrderId,
                device: deviceText,
            }));

            res.json({
                ...orderResult.rows[0],
                ...masterFields,
                message: 'Замовлення створено',
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка створення замовлення' });
        }
    });

    router.get('/:id/history', authMiddleware, async (req, res) => {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return sendValidationError(res, ['Некоректний номер замовлення']);
        }

        try {
            if (!(await requireOrderAccess(req, res, id))) return;

            res.json(await getStatusHistory(Number(id)));
        } catch (err) {
            console.error('Помилка завантаження історії статусів:', err.message);
            res.status(500).json({ error: 'Помилка завантаження історії статусів' });
        }
    });

    router.put('/:id/master', authMiddleware, requireAnyRole('адмін', 'менеджер'), async (req, res) => {
        const { id } = req.params;
        const { masterId } = req.body;
        const validationErrors = [
            !isPositiveInteger(id) && 'Некоректний номер замовлення',
            !isPositiveInteger(masterId) && 'Оберіть майстра',
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        try {
            const masterResult = await pool.query(
                'SELECT id FROM masters WHERE id = $1 AND is_active = TRUE',
                [Number(masterId)]
            );

            if (masterResult.rows.length === 0) {
                return res.status(404).json({ error: 'Майстра не знайдено або він неактивний' });
            }

            const result = await pool.query(
                `UPDATE orders
                 SET assigned_master_id = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING id, assigned_master_id`,
                [Number(masterId), Number(id)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            const masterFields = await getOrderMasterFields(Number(id));
            res.json({ ...result.rows[0], ...masterFields });
        } catch (err) {
            console.error('Помилка призначення майстра:', err.message);
            res.status(500).json({ error: 'Помилка призначення майстра' });
        }
    });

    router.put('/:id/status', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const isAllowedStatus = ORDER_STATUSES.some((allowedStatus) => isRepairStatus(status, allowedStatus));

        if (!isPositiveInteger(id)) {
            return sendValidationError(res, ['Некоректний номер замовлення']);
        }

        if (!isAllowedStatus) {
            return sendValidationError(res, ['Некоректний статус замовлення']);
        }

        try {
            if (!(await requireOrderAccess(req, res, id))) return;

            const currentOrder = await pool.query(
                'SELECT id, status FROM orders WHERE id = $1',
                [Number(id)]
            );

            if (currentOrder.rows.length === 0) {
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            if (isRepairStatus(status, 'виконано')) {
                return res.status(400).json({ error: 'Для статусу "Виконано" використовуйте завершення ремонту з ціною.' });
            }

            const result = isRepairStatus(status, 'ремонт')
                ? await pool.query(
                    `UPDATE orders
                     SET status = $1,
                         assigned_master_id = COALESCE(assigned_master_id, $2),
                         updated_at = NOW()
                     WHERE id = $3
                     RETURNING *`,
                    [status, await getRandomMasterId(), Number(id)]
                )
                : await pool.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                    [status, Number(id)]
                );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            await recordStatusHistory(Number(id), currentOrder.rows[0].status, result.rows[0].status, req.user.username);

            const clientResult = await pool.query(`
                SELECT c.email, c.full_name, d.brand, d.model, o.repair_price
                FROM orders o
                JOIN devices d ON o.device_id = d.id
                JOIN clients c ON d.client_id = c.id
                WHERE o.id = $1
            `, [Number(id)]);

            try {
                await sendStatusEmail(Number(id), status, clientResult.rows[0]);
            } catch (notificationError) {
                console.error('Email про статус не відправлено:', notificationError.message);
            }

            const masterFields = await getOrderMasterFields(Number(id));
            res.json({
                ...result.rows[0],
                ...masterFields,
                status_history: await getStatusHistory(Number(id)),
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Помилка оновлення статусу' });
        }
    });

    router.put('/:id/complete', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { repairPrice, laborPrice, comment, usedParts = [] } = req.body;
        const rawLaborPrice = laborPrice ?? repairPrice ?? 0;
        const normalizedLaborPrice = Number(rawLaborPrice);
        const completionErrors = [
            !isPositiveInteger(id) && 'Некоректний номер замовлення',
            validateNumber(normalizedLaborPrice, 'Вартість роботи'),
            !Array.isArray(usedParts) && 'Список деталей має бути масивом',
        ];

        if (Array.isArray(usedParts)) {
            usedParts.forEach((usedPart, index) => {
                if (isBlank(usedPart.partId) && isBlank(usedPart.quantity)) return;
                completionErrors.push(validateNumber(usedPart.partId, `Деталь #${index + 1}`, { min: 1, integer: true }));
                completionErrors.push(validateNumber(usedPart.quantity, `Кількість деталі #${index + 1}`, { min: 1, integer: true }));
            });
        }

        if (completionErrors.some(Boolean)) {
            return sendValidationError(res, completionErrors);
        }

        if (!(await requireOrderAccess(req, res, id))) return;

        const client = await pool.connect();
        let partsTotal = 0;

        try {
            await client.query('BEGIN');

            const orderResult = await client.query('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [Number(id)]);

            if (orderResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            await client.query(`
                UPDATE spare_parts AS sp
                SET quantity = sp.quantity + used_parts.quantity_used
                FROM (
                    SELECT part_id, SUM(quantity_used)::integer AS quantity_used
                    FROM order_parts
                    WHERE order_id = $1
                    GROUP BY part_id
                ) AS used_parts
                WHERE sp.id = used_parts.part_id
            `, [Number(id)]);

            await client.query('DELETE FROM order_parts WHERE order_id = $1', [Number(id)]);

            for (const usedPart of usedParts) {
                const partId = Number(usedPart.partId);
                const quantity = Number(usedPart.quantity);

                if (!partId || !quantity || quantity <= 0) continue;

                const partResult = await client.query(
                    'SELECT id, part_name, quantity, price FROM spare_parts WHERE id = $1 FOR UPDATE',
                    [partId]
                );

                if (partResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Обрану деталь не знайдено' });
                }

                const part = partResult.rows[0];

                if (Number(part.quantity) < quantity) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Недостатньо на складі: ${part.part_name}` });
                }

                await client.query(
                    'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
                    [Number(id), partId, quantity, part.price]
                );
                await client.query('UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2', [quantity, partId]);
                partsTotal += Number(part.price || 0) * quantity;
            }

            const totalRepairPrice = normalizedLaborPrice + partsTotal;

            const updatedOrder = await client.query(
                `UPDATE orders
                 SET status = 'виконано',
                     labor_price = $1,
                     repair_price = $2,
                     completion_comment = $3,
                     assigned_master_id = COALESCE(assigned_master_id, $4),
                     updated_at = NOW()
                 WHERE id = $5
                 RETURNING id, status, labor_price, repair_price, completion_comment, assigned_master_id`,
                [normalizedLaborPrice, totalRepairPrice, comment || null, await getRandomMasterId(client), Number(id)]
            );

            await recordStatusHistory(Number(id), orderResult.rows[0].status, updatedOrder.rows[0].status, req.user.username, client);

            const usedPartsResult = await client.query(`
                SELECT op.part_id, sp.part_name, op.quantity_used, op.price_at_time
                FROM order_parts op
                JOIN spare_parts sp ON sp.id = op.part_id
                WHERE op.order_id = $1
                ORDER BY sp.part_name
            `, [Number(id)]);

            await client.query('COMMIT');

            try {
                await sendCompletionNotifications(Number(id), totalRepairPrice);
            } catch (notificationError) {
                console.error('Сповіщення про завершення не відправлено:', notificationError.message);
            }

            res.json({
                ...updatedOrder.rows[0],
                ...(await getOrderMasterFields(Number(id), client)),
                used_parts: usedPartsResult.rows,
                status_history: await getStatusHistory(Number(id), client),
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Помилка завершення замовлення:', err.message);
            res.status(500).json({ error: 'Помилка завершення замовлення' });
        } finally {
            client.release();
        }
    });

    router.delete('/:id', authMiddleware, requireAnyRole('адмін'), async (req, res) => {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return sendValidationError(res, ['Некоректний номер замовлення']);
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const orderResult = await client.query(
                'SELECT id, device_id FROM orders WHERE id = $1 FOR UPDATE',
                [Number(id)]
            );

            if (orderResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            const { device_id } = orderResult.rows[0];

            await client.query(`
                UPDATE spare_parts AS sp
                SET quantity = sp.quantity + used_parts.quantity_used
                FROM (
                    SELECT part_id, SUM(quantity_used)::integer AS quantity_used
                    FROM order_parts
                    WHERE order_id = $1
                    GROUP BY part_id
                ) AS used_parts
                WHERE sp.id = used_parts.part_id
            `, [Number(id)]);

            await client.query('DELETE FROM order_parts WHERE order_id = $1', [Number(id)]);
            await client.query('DELETE FROM orders WHERE id = $1', [Number(id)]);
            await client.query(`
                DELETE FROM devices
                WHERE id = $1
                  AND NOT EXISTS (
                    SELECT 1 FROM orders WHERE device_id = $1
                  )
            `, [device_id]);

            await client.query('COMMIT');
            res.json({ success: true, deletedOrderId: Number(id) });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Помилка видалення замовлення:', err.message);
            res.status(500).json({ error: 'Помилка видалення замовлення' });
        } finally {
            client.release();
        }
    });

    router.post('/:id/parts', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { partId, quantity } = req.body;
        const validationErrors = [
            !isPositiveInteger(id) && 'Некоректний номер замовлення',
            validateNumber(partId, 'Деталь', { min: 1, integer: true }),
            validateNumber(quantity, 'Кількість деталі', { min: 1, integer: true }),
        ];

        if (validationErrors.some(Boolean)) {
            return sendValidationError(res, validationErrors);
        }

        if (!(await requireOrderAccess(req, res, id))) return;

        const normalizedPartId = Number(partId);
        const normalizedQuantity = Number(quantity);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const order = await client.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [Number(id)]);
            if (order.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            const part = await client.query(
                'SELECT price, quantity FROM spare_parts WHERE id = $1 FOR UPDATE',
                [normalizedPartId]
            );
            if (part.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Деталь не знайдена' });
            }

            if (Number(part.rows[0].quantity) < normalizedQuantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Недостатньо деталей на складі' });
            }

            await client.query(
                'INSERT INTO order_parts (order_id, part_id, quantity_used, price_at_time) VALUES ($1, $2, $3, $4)',
                [Number(id), normalizedPartId, normalizedQuantity, part.rows[0].price]
            );
            await client.query(
                'UPDATE spare_parts SET quantity = quantity - $1 WHERE id = $2',
                [normalizedQuantity, normalizedPartId]
            );
            await client.query('COMMIT');

            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: 'Помилка додавання деталі' });
        } finally {
            client.release();
        }
    });

    return router;
};
