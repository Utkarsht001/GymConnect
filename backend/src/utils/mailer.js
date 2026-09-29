import nodemailer from 'nodemailer';

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    console.log(`[EmailService] Using configured SMTP server: ${host || 'default service'}`);
    cachedTransporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
    return cachedTransporter;
  }

  // Fallback to Ethereal / Test SMTP account if no credentials supplied in environment
  try {
    console.log('[EmailService] No SMTP credentials found in env. Creating Ethereal test mailer account...');
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`[EmailService] Ethereal test account created: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err) {
    console.warn('[EmailService] Failed to create Ethereal test account, using log-only transporter:', err.message);
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    return cachedTransporter;
  }
}

/**
 * Send password reset OTP email to specified user
 */
export async function sendOtpEmail(toEmail, otpCode, userName = 'Member') {
  const transporter = await getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || '"GYMGO Support" <no-reply@gymconnect.com>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'GYMGO - Password Reset OTP Code',
    text: `Hello ${userName},\n\nYour OTP code to reset your GYMGO password is: ${otpCode}\n\nThis code is valid for 15 minutes. Do not share this OTP with anyone.\n\nBest regards,\nGYMGO Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0d1117; color: #ffffff; border-radius: 10px; border: 1px solid #30363d;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #21262d;">
          <h2 style="color: #00ffcc; margin: 0;">🏋️ GYMGO</h2>
          <p style="color: #8b949e; font-size: 14px; margin-top: 5px;">Jaipur's Premium Fitness Circle</p>
        </div>
        <div style="padding: 20px 0;">
          <h3 style="color: #ffffff;">Password Reset Request</h3>
          <p style="color: #c9d1d9; font-size: 15px; line-height: 1.5;">
            Hello <strong>${userName}</strong>,<br/>
            We received a request to reset the password for your GYMGO account associated with <strong>${toEmail}</strong>.
          </p>
          <div style="background: rgba(0, 255, 204, 0.1); border: 1px dashed #00ffcc; border-radius: 8px; padding: 15px; text-align: center; margin: 25px 0;">
            <span style="display: block; color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 6-Digit OTP Code</span>
            <span style="font-size: 32px; font-weight: bold; color: #00ffcc; letter-spacing: 6px; font-family: monospace;">${otpCode}</span>
          </div>
          <p style="color: #8b949e; font-size: 13px;">
            ⚠️ This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.
          </p>
        </div>
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #21262d; color: #484f58; font-size: 12px;">
          &copy; ${new Date().getFullYear()} GYMGO. All rights reserved.
        </div>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] OTP email sent to ${toEmail}. Message ID: ${info.messageId}`);
  
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[EmailService] Ethereal Email Preview URL: ${previewUrl}`);
  }

  return info;
}
