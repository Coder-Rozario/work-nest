const nodemailer = require('nodemailer');

let transporter = null;
let cachedSignature = '';

const readSmtpConfig = () => ({
  host: String(process.env.SMTP_HOST || '').trim(),
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true',
  user: String(process.env.SMTP_USER || '').trim(),
  pass: String(process.env.SMTP_PASS || ''),
  from: String(process.env.SMTP_FROM || '').trim(),
});

const isMailConfigured = () => {
  const config = readSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
};

const getTransporter = () => {
  const config = readSmtpConfig();
  const signature = `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass}`;

  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  if (!transporter || cachedSignature !== signature) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    cachedSignature = signature;
  }

  return transporter;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildResetCodeMail = ({ code, name, expiresInMinutes }) => {
  const safeName = escapeHtml(name || 'there');
  const spacedCode = String(code).split('').join('&nbsp;');

  const subject = 'Your WorkNest verification code';

  const text = [
    `Hello ${name || 'there'},`,
    '',
    `Your WorkNest account verification code is: ${code}`,
    `This code expires in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this code, please ignore this email.',
    '',
    'WorkNest Security Team',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:#172554;padding:22px 28px;color:#ffffff;">
          <div style="font-size:20px;font-weight:600;">Work<span style="color:#4ade80;">Nest</span></div>
          <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Secure account recovery</div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Hello ${safeName},</p>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
            Use the verification code below to confirm your identity and access your WorkNest account.
          </p>
          <div style="text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#64748b;">Verification code</div>
            <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#172554;margin-top:10px;">${spacedCode}</div>
          </div>
          <p style="margin:20px 0 0;font-size:13px;color:#475569;">
            This code expires in <strong>${expiresInMinutes} minutes</strong>.
          </p>
          <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
            If you did not request this code, no action is required and you can safely ignore this email.
          </p>
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          WorkNest Security Team
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
};

const sendResetCodeEmail = async ({ to, name, code, expiresInMinutes = 15 }) => {
  const mailer = getTransporter();

  if (!mailer) {
    const error = new Error('SMTP is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const config = readSmtpConfig();
  const { subject, text, html } = buildResetCodeMail({ code, name, expiresInMinutes });

  return mailer.sendMail({
    from: config.from || `WorkNest Security <${config.user}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  isMailConfigured,
  sendResetCodeEmail,
};
