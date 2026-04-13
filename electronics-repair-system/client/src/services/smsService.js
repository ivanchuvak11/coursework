// Насправді тут буде інтеграція з Twilio або іншим SMS-провайдером
export const sendSMS = async (phone, message) => {
    console.log(`📱 SMS to ${phone}: ${message}`);
    // Для реального SMS використовуйте Twilio:
    // const accountSid = process.env.TWILIO_SID;
    // const authToken = process.env.TWILIO_TOKEN;
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({ body: message, to: phone, from: '+1234567890' });
    
    return { success: true };
};