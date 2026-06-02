const { normalizeSmsPhone } = require('../services/smsService');

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function isValidEmail(email) {
    return isBlank(email) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidPhone(phone) {
    return normalizeSmsPhone(phone).length >= 10;
}

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function validateNumber(value, fieldName, { min = 0, integer = false } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
        return `${fieldName} має бути ${integer ? 'цілим ' : ''}числом не менше ${min}`;
    }
    return null;
}

function sendValidationError(res, errors) {
    return res.status(400).json({ error: errors.filter(Boolean).join('; ') });
}

module.exports = {
    isBlank,
    isValidEmail,
    isValidPhone,
    isPositiveInteger,
    validateNumber,
    sendValidationError,
};
