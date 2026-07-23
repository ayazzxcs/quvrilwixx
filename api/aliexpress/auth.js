const crypto = require('crypto');

const ALIEXPRESS_APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const ALIEXPRESS_CALLBACK_URL =
  process.env.ALIIEXPRESS_CALLBACK_URL ||
  process.env.ALIEXPRESS_CALLBACK_URL ||
  'https://quvirl.com/api/aliexpress/callback';

function makeState() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = async function handler(req, res) {
  try {
    if (!ALIEXPRESS_APP_KEY) {
      return res.status(500).send('Missing ALIEXPRESS_APP_KEY');
    }

    const state = makeState();

    const authUrl =
      'https://api-sg.aliexpress.com/oauth/authorize' +
      '?response_type=code' +
      '&force_auth=true' +
      '&redirect_uri=' + encodeURIComponent(ALIEXPRESS_CALLBACK_URL) +
      '&client_id=' + encodeURIComponent(ALIEXPRESS_APP_KEY) +
      '&state=' + encodeURIComponent(state);

    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
``
