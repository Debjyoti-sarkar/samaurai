const fast2smsService = require('./fast2smsOtpService');
const msg91Service = require('./msg91OtpService');

const getPrimaryProvider = () => (process.env.OTP_PROVIDER || 'msg91').toLowerCase();

const getProviderOrder = () => {
  const primary = getPrimaryProvider();
  if (primary === 'fast2sms') {
    return ['fast2sms', 'msg91'];
  }
  return ['msg91', 'fast2sms'];
};

const providerServices = {
  fast2sms: fast2smsService,
  msg91: msg91Service,
};

const callProvider = async (provider, method, ...args) => {
  const service = providerServices[provider];
  if (!service || typeof service[method] !== 'function') {
    return {
      success: false,
      message: `Provider ${provider} is not available`,
      provider,
    };
  }

  const result = await service[method](...args);
  return {
    ...result,
    provider,
  };
};

async function sendOTP(phoneNumber) {
  const providers = getProviderOrder();
  let lastError = null;

  for (const provider of providers) {
    const result = await callProvider(provider, 'sendOTP', phoneNumber);
    if (result.success) {
      return result;
    }
    lastError = result;
  }

  return {
    success: false,
    message: lastError?.message || 'Failed to send OTP from all providers',
    error: lastError?.error,
    provider: lastError?.provider,
    providerStatus: lastError?.providerStatus,
    providerResponse: lastError?.providerResponse,
  };
}

async function verifyOTP(phoneNumber, code) {
  const provider = getPrimaryProvider();
  return callProvider(provider, 'verifyOTP', phoneNumber, code);
}

module.exports = {
  sendOTP,
  verifyOTP,
};
