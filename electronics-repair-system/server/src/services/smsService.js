const twilio = require('twilio');

function createTwilioClient() {
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();

    if (!accountSid || !authToken) {
        return null;
    }

    if (!accountSid.startsWith('AC')) {
        console.error('SMS не налаштовано: TWILIO_ACCOUNT_SID має починатися з "AC".');
        return null;
    }

    try {
        return twilio(accountSid, authToken);
    } catch (error) {
        console.error('SMS не налаштовано:', error.message);
        return null;
    }
}

const twilioClient = createTwilioClient();

function normalizeSmsPhone(phone = '') {
    const digits = String(phone).replace(/\D/g, '');

    if (digits.startsWith('380')) return `+${digits}`;
    if (digits.startsWith('0')) return `+38${digits}`;
    if (String(phone).trim().startsWith('+')) return String(phone).trim();

    return digits ? `+${digits}` : '';
}

function buildOrderAcceptedSms({ orderId, device }) {
    const deviceText = device ? ` (${device})` : '';
    return `Смарт лайф: замовлення #${orderId}${deviceText} прийнято в роботу. Ми повідомимо, коли ремонт буде виконано.`;
}

function buildOrderCompletedSms({ orderId, device, paymentAmount }) {
    const deviceText = device ? ` (${device})` : '';
    const amountText = Number(paymentAmount) > 0 ? ` До оплати: ${Number(paymentAmount).toFixed(2)} грн.` : '';
    return `Смарт лайф: ремонт замовлення #${orderId}${deviceText} виконано.${amountText} Пристрій готовий до видачі.`;
}

async function sendSms(to, message) {
    const sender = process.env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
        : { from: process.env.TWILIO_PHONE_NUMBER };

    if (!twilioClient || (!process.env.TWILIO_PHONE_NUMBER && !process.env.TWILIO_MESSAGING_SERVICE_SID)) {
        console.warn('SMS пропущено: Twilio не налаштовано');
        return false;
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            to: normalizeSmsPhone(to),
            ...sender,
        });
        console.log(`SMS відправлено: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('SMS не відправлено:', error.message);
        return false;
    }
}

function isSmsConfigured() {
    return Boolean(twilioClient && (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

module.exports = {
    normalizeSmsPhone,
    buildOrderAcceptedSms,
    buildOrderCompletedSms,
    sendSms,
    isSmsConfigured,
};
