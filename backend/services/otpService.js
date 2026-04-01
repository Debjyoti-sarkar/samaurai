const fast2smsService = require('./fast2smsOtpService');

async function sendOTP(phoneNumber) {
  const result = await fast2smsService.sendOTP(phoneNumber);
  return {
    ...result,
    provider: 'fast2sms',
  };
}

async function verifyOTP(phoneNumber, code) {
  const result = await fast2smsService.verifyOTP(phoneNumber, code);
  return {
    ...result,
    provider: 'fast2sms',
  };
}

module.exports = {
  sendOTP,
  verifyOTP,
};
