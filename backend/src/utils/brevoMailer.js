/**
 * Brevo (formerly Sendinblue) Transactional Email Service
 * GymConnect Authentication & Password Recovery
 * 
 * Official Brevo API documentation:
 * https://developers.brevo.com/docs/send-a-transactional-email
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 */

const BREVO_API_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Validates whether Brevo credentials and configuration are present.
 * @returns {{ isConfigured: boolean, missingKeys: string[], senderEmail: string, frontendUrl: string }}
 */
export function checkBrevoConfiguration() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || '').trim();
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();

  const missingKeys = [];
  if (!apiKey) missingKeys.push('BREVO_API_KEY');
  if (!senderEmail) missingKeys.push('BREVO_SENDER_EMAIL');

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
    senderEmail: senderEmail || 'not-configured@gymconnect.local',
    frontendUrl
  };
}

function extractEmailAddress(input) {
  if (!input || typeof input !== 'string') return '';
  const match = input.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return input.trim().toLowerCase();
}

/**
 * Generic Brevo Transactional Email Sender via direct REST API
 * @param {Object} options
 * @param {Array<{email: string, name?: string}>} options.to
 * @param {string} options.subject
 * @param {string} options.htmlContent
 * @param {string} [options.textContent]
 * @param {string} [options.replyTo]
 * @returns {Promise<{ messageId: string, status: number }>}
 */
export async function sendBrevoTransactionalEmail({ to, subject, htmlContent, textContent, replyTo }) {
  const config = checkBrevoConfiguration();

  if (!config.isConfigured) {
    const errorMsg = `[BrevoMailer] Missing required configuration: ${config.missingKeys.join(', ')}. Please set them in your backend .env file.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const apiKey = process.env.BREVO_API_KEY.trim();
  const rawSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || config.senderEmail;
  const senderEmail = extractEmailAddress(rawSenderEmail);
  const senderName = process.env.BREVO_SENDER_NAME || 'GymConnect';

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail
    },
    to: to.map(recipient => ({
      email: recipient.email.toLowerCase().trim(),
      name: recipient.name || 'Member'
    })),
    subject,
    htmlContent,
    textContent: textContent || subject
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(BREVO_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errCode = responseData.code || response.status;
      const errMsg = responseData.message || response.statusText || 'Brevo API transaction failed';
      console.error(`[BrevoMailer ERROR] HTTP ${response.status} (${errCode}): ${errMsg}`);
      
      if (response.status === 401) {
        throw new Error('Brevo API authentication failed. Please verify that BREVO_API_KEY is valid.');
      } else if (response.status === 400) {
        throw new Error(`Brevo API request error: ${errMsg}`);
      } else {
        throw new Error(`Brevo API error (${response.status}): ${errMsg}`);
      }
    }

    const messageId = responseData.messageId || 'dispatched';
    console.log(`[BrevoMailer SUCCESS] Email dispatched to ${to.map(t => t.email).join(', ')} - MessageId: ${messageId}`);
    return { messageId, status: response.status };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[BrevoMailer ERROR] Request timed out after 10 seconds.');
      throw new Error('Brevo service timed out while dispatching email. Please try again.');
    }
    // Re-throw without leaking sensitive internal details
    throw error;
  }
}

/**
 * Sends a responsive, branded password reset email containing a secure link.
 * @param {string} toEmail 
 * @param {string} rawResetToken 
 * @param {string} [userName] 
 * @returns {Promise<{ messageId: string, status: number }>}
 */
export async function sendPasswordResetEmail(toEmail, rawResetToken, userName = 'Member') {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawResetToken)}`;

  const subject = '🔐 Reset Your GymConnect Password';
  const textContent = `Hello ${userName},\n\nWe received a request to reset the password for your GymConnect account (${toEmail}).\n\nClick the link below or copy and paste it into your browser to set a new password:\n${resetLink}\n\n⏱️ This password reset link is valid for 15 minutes and can only be used once.\n\nIf you did not make this request, you can safely ignore this email. Your password will remain unchanged.\n\nBest regards,\nThe GymConnect Security Team`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your GymConnect Password</title>
      <style>
        body { margin: 0; padding: 0; background-color: #0b0d10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f6fc; }
        .wrapper { max-width: 600px; margin: 30px auto; background-color: #15181e; border: 1px solid #21262d; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #15181e 0%, #1c2128 100%); padding: 30px 24px; text-align: center; border-bottom: 1px solid #30363d; }
        .header h1 { margin: 0; color: #00ffcc; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
        .header p { margin: 6px 0 0 0; color: #8b949e; font-size: 13px; }
        .content { padding: 32px 28px; }
        .content h2 { margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600; }
        .content p { margin: 0 0 16px 0; color: #c9d1d9; font-size: 15px; line-height: 1.6; }
        .btn-container { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; background-color: #00ffcc; color: #0b0d10 !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; box-shadow: 0 4px 14px rgba(0, 255, 204, 0.35); }
        .notice-box { background-color: rgba(0, 255, 204, 0.05); border-left: 3px solid #00ffcc; padding: 14px 16px; border-radius: 4px; margin: 24px 0; }
        .notice-box p { margin: 0; font-size: 13px; color: #8b949e; line-height: 1.5; }
        .link-fallback { background-color: #0b0d10; border: 1px solid #21262d; border-radius: 6px; padding: 12px; margin-top: 20px; word-break: break-all; font-family: monospace; font-size: 12px; color: #00ffcc; }
        .footer { padding: 20px 24px; text-align: center; border-top: 1px solid #21262d; background-color: #0f1217; }
        .footer p { margin: 0; color: #6e7681; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>🏋️ GymConnect</h1>
          <p>Jaipur's Premium Fitness Circle</p>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello <strong style="color: #ffffff;">${userName}</strong>,</p>
          <p>We received a request to reset your password for your GymConnect account associated with <strong style="color: #00ffcc;">${toEmail}</strong>.</p>
          <p>Click the button below to choose a new, secure password:</p>
          
          <div class="btn-container">
            <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
          </div>

          <div class="notice-box">
            <p>⏱️ <strong>Link Expiration:</strong> This reset link will expire in <strong>15 minutes</strong> and can only be used once.</p>
            <p style="margin-top: 6px;">🔒 <strong>Security Warning:</strong> If you did not request this reset, you can safely ignore this email. Your account remains secure.</p>
          </div>

          <p style="font-size: 13px; color: #8b949e; margin-bottom: 6px;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <div class="link-fallback">${resetLink}</div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} GymConnect Inc. All rights reserved.</p>
          <p style="margin-top: 4px;">Security & Account Protection Service</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendBrevoTransactionalEmail({
    to: [{ email: toEmail, name: userName }],
    subject,
    htmlContent,
    textContent
  });
}
