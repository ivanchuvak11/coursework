const nodemailer = require('nodemailer');
const dns = require('dns');

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
    tls: {
        servername: 'smtp.gmail.com',
        rejectUnauthorized: true,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
});

function isEmailConfigured() {
    return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

async function verifyEmailTransport() {
    if (!isEmailConfigured()) {
        console.warn('Email не налаштовано: EMAIL_USER або EMAIL_PASS відсутні');
        return false;
    }

    try {
        await emailTransporter.verify();
        console.log('✅ Gmail налаштовано');
        return true;
    } catch (error) {
        console.error('❌ Gmail помилка:', error.message);
        return false;
    }
}

async function sendEmail(to, subject, htmlContent) {
    if (!isEmailConfigured()) {
        console.warn('Email пропущено: Gmail не налаштовано');
        return false;
    }

    try {
        await emailTransporter.sendMail({
            from: `"Смарт лайф" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: htmlContent,
        });
        return true;
    } catch (error) {
        console.error('Email не відправлено:', error.message);
        return false;
    }
}

function escapeEmailHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatEmailCurrency(amount) {
    const value = Number(amount || 0);
    return `${value.toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} грн`;
}

function buildRepairEmailTemplate({
    clientName,
    orderId,
    device,
    statusLabel,
    statusColor = '#0d9488',
    title,
    message,
    nextStep,
    paymentAmount,
    isComplete = false,
}) {
    const safeClientName = escapeEmailHtml(clientName || 'клієнте');
    const safeDevice = escapeEmailHtml(device || 'не вказано');
    const safeStatus = escapeEmailHtml(statusLabel || 'оновлено');
    const safeTitle = escapeEmailHtml(title || 'Статус замовлення оновлено');
    const safeNextStep = escapeEmailHtml(nextStep || 'Ми повідомимо про наступне оновлення');
    const paymentBlock = isComplete
        ? `
            <tr>
                <td style="padding:0 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; background:#0f9b8e; border-radius:12px;">
                        <tr>
                            <td style="padding:20px 22px;">
                                <div style="color:#ccfbf1; font-size:13px; font-weight:600; letter-spacing:.03em; text-transform:uppercase;">До оплати</div>
                                <div style="color:#ffffff; font-size:30px; line-height:1.2; font-weight:600; margin-top:8px;">${formatEmailCurrency(paymentAmount)}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        `
        : '';

    return `
        <div style="margin:0; padding:0; background:#eef8f6; font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; background:#eef8f6;">
                <tr>
                    <td align="center" style="padding:28px 12px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; max-width:660px; background:#ffffff;">
                            <tr>
                                <td style="padding:18px 22px 12px;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                                        <tr>
                                            <td>
                                                <div style="color:#0f9b8e; font-size:21px; font-weight:600; line-height:1.15;">Смарт</div>
                                                <div style="color:#10233f; font-size:15px; font-weight:600; line-height:1.15;">лайф</div>
                                            </td>
                                            <td align="right">
                                                <span style="display:inline-block; background:#dcfce7; color:#064e3b; border:1px solid #86efac; border-radius:999px; padding:10px 16px; font-size:14px; font-weight:600;">#${orderId}</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding:0 22px 20px;">
                                    <div style="background:#e7f4f2; border:1px solid #c8dddd; border-radius:14px; padding:22px;">
                                        <h1 style="margin:0 0 12px; color:#10233f; font-size:27px; line-height:1.25; font-weight:600;">${safeTitle}</h1>
                                        <div style="color:#51677f; font-size:15px; line-height:1.7;">
                                            Вітаємо, <strong style="color:#10233f; font-weight:600;">${safeClientName}</strong>. ${message}
                                        </div>
                                    </div>
                                </td>
                            </tr>

                            ${paymentBlock}

                            <tr>
                                <td style="padding:0 22px 22px;">
                                    <div style="color:#10233f; font-size:16px; font-weight:600; margin-bottom:10px;">Деталі замовлення</div>
                                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; border:1px solid #d7e2ea;">
                                        <tr>
                                            <td style="padding:14px 18px; border-bottom:1px solid #e5edf2; color:#63768c; font-size:14px;">Поточний статус</td>
                                            <td align="right" style="padding:14px 18px; border-bottom:1px solid #e5edf2;">
                                                <span style="display:inline-block; background:${statusColor}; color:#ffffff; border-radius:999px; padding:9px 14px; font-size:13px; font-weight:600;">${safeStatus}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 18px; border-bottom:1px solid #e5edf2; color:#63768c; font-size:14px;">Номер замовлення</td>
                                            <td align="right" style="padding:14px 18px; border-bottom:1px solid #e5edf2; color:#10233f; font-size:14px; font-weight:600;">#${orderId}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 18px; border-bottom:1px solid #e5edf2; color:#63768c; font-size:14px;">Пристрій</td>
                                            <td align="right" style="padding:14px 18px; border-bottom:1px solid #e5edf2; color:#10233f; font-size:14px; font-weight:600;">${safeDevice}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding:14px 18px; color:#63768c; font-size:14px;">Що далі</td>
                                            <td align="right" style="padding:14px 18px; color:#10233f; font-size:14px; font-weight:600;">${safeNextStep}</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding:0 22px 24px;">
                                    <div style="background:#ccfbf1; border:1px solid #5eead4; border-radius:12px; padding:16px 18px;">
                                        <div style="color:#10233f; font-size:15px; font-weight:600; margin-bottom:5px;">Дякуємо, що обрали Смарт лайф</div>
                                        <div style="color:#63768c; font-size:13px; line-height:1.55;">Цей лист сформовано автоматично. Якщо маєте питання, зверніться до сервісного центру.</div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
}

module.exports = {
    sendEmail,
    isEmailConfigured,
    verifyEmailTransport,
    buildRepairEmailTemplate,
};
