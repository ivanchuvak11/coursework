const ORDER_STATUSES = ['прийнято', 'діагностика', 'ремонт', 'виконано', 'видано'];

function legacyUtf8Text(text) {
    return Buffer.from(text, 'utf8').toString('latin1');
}

function isRepairStatus(status, text) {
    return status === text || status === legacyUtf8Text(text);
}

module.exports = {
    ORDER_STATUSES,
    isRepairStatus,
};
