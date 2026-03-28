/**
 * SMS provider config — Fast2SMS or MSG91.
 * Replace sendOtp body with real API call when keys are set.
 */
const provider = process.env.SMS_PROVIDER || 'fast2sms';
const apiKey = process.env.SMS_API_KEY;
const senderId = process.env.SMS_SENDER_ID || 'VVMCOT';

/**
 * Send OTP SMS to phone. Stub if SMS_API_KEY not set.
 * @param {string} phone - 10-digit Indian mobile
 * @param {string} message - e.g. "Your VVMC OTP is 1234. Valid 10 min."
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendSms(phone, message) {
  const normalized = String(phone).replace(/\D/g, '').slice(-10);
  if (!normalized || normalized.length < 10) {
    return { ok: false, error: 'Invalid phone' };
  }
  if (!apiKey) {
    console.warn('[SMS] No SMS_API_KEY set; skipping send. Message:', message);
    return { ok: true };
  }
  try {
    if (provider === 'fast2sms') {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: apiKey },
        body: JSON.stringify({
          route: 'q',
          message,
          numbers: [normalized],
          flash: 0,
        }),
      });
      const data = await res.json();
      if (data.return === true) return { ok: true };
      return { ok: false, error: data.message || 'Fast2SMS error' };
    }
    if (provider === 'msg91') {
      const res = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: apiKey },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          short_url: '0',
          recipients: [{ mobiles: `91${normalized}`, otp: message.replace(/\D/g, '').slice(-4) }],
        }),
      });
      const data = await res.json();
      if (data.type === 'success') return { ok: true };
      return { ok: false, error: data.message || 'MSG91 error' };
    }
  } catch (err) {
    console.error('[SMS]', err);
    return { ok: false, error: err.message };
  }
  return { ok: false, error: 'Unknown SMS provider' };
}

export { provider, apiKey, senderId };
