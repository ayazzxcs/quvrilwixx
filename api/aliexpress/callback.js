module.exports = async function handler(req, res) {
  try {
    const { code, state, uuid } = req.query;

    if (!code) {
      return res.status(400).send('Missing AliExpress authorization code');
    }

    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AliExpress Connected - Quvirl</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #020617;
              color: #e5eefb;
              padding: 32px;
            }
            .card {
              max-width: 720px;
              margin: 40px auto;
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 20px;
              padding: 24px;
            }
            code {
              display: block;
              white-space: pre-wrap;
              word-break: break-all;
              background: #020617;
              border: 1px solid #334155;
              padding: 14px;
              border-radius: 12px;
              color: #86efac;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AliExpress authorization received</h1>
            <p>Quvirl received the AliExpress authorization code successfully.</p>
            <p><strong>Authorization code:</strong></p>
            <code>${String(code)}</code>
            <p><strong>State:</strong> ${String(state || '')}</p>
            <p><strong>UUID:</strong> ${String(uuid || '')}</p>
            <p>Next step: exchange this code for an access token.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
