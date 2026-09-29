import nodemailer from 'nodemailer';

/**
 * Creates and returns an active Nodemailer transporter based on .env config.
 */
async function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass) {
    console.log(`[EmailService] Creating SMTP transporter for ${user} via ${host}:${port}`);
    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Fallback: Try Ethereal account if no user/pass in env
  console.warn('[EmailService WARNING] No SMTP_USER and SMTP_PASS found in backend/.env! Creating temporary Ethereal test account...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[EmailService] Created test Ethereal account: ${testAccount.user}`);
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } catch (err) {
    console.warn('[EmailService] Ethereal fallback failed, falling back to JSON stream transporter:', err.message);
    return nodemailer.createTransport({
      jsonTransport: true
    });
  }
}

/**
 * Send password reset OTP email to specified user.
 * @param {string} toEmail 
 * @param {string} otpCode 
 * @param {string} userName 
 */
export async function sendOtpEmail(toEmail, otpCode, userName = 'Member') {
  const transporter = await getTransporter();
  const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || '"GYMGO Support" <no-reply@gymconnect.com>';

  const mailOptions = {
    from: senderEmail,
    to: toEmail,
    subject: '🏋️ GYMGO - Your Password Reset OTP Code',
    text: `Hello ${userName},\n\nYour OTP code to reset your GYMGO account password is: ${otpCode}\n\nThis code is valid for 15 minutes. Do not share this OTP with anyone.\n\nBest regards,\nGYMGO Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; background: #0b0d10; color: #f0f6fc; border-radius: 12px; border: 1px solid #21262d;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #30363d;">
          <h1 style="color: #00ffcc; margin: 0; font-size: 28px; letter-spacing: 1px;">🏋️ GYMGO</h1>
          <p style="color: #8b949e; font-size: 13px; margin-top: 6px;">Jaipur's Premium Fitness Circle</p>
        </div>
        
        <div style="padding: 25px 0;">
          <h3 style="color: #ffffff; margin-top: 0; font-size: 20px;">Password Reset Code</h3>
          <p style="color: #c9d1d9; font-size: 15px; line-height: 1.6;">
            Hello <strong style="color: #ffffff;">${userName}</strong>,<br/>
            We received a request to reset your password for your GYMGO account linked to <strong style="color: #00ffcc;">${toEmail}</strong>.
          </p>
          
          <div style="background: rgba(0, 255, 204, 0.08); border: 1.5px dashed #00ffcc; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
            <span style="display: block; color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">Verification OTP Code</span>
            <span style="font-size: 36px; font-weight: 800; color: #00ffcc; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
          </div>
          
          <p style="color: #8b949e; font-size: 13px; line-height: 1.5;">
            ⏱️ This OTP code is valid for <strong>15 minutes</strong>.<br/>
            🔒 If you did not initiate this request, please ignore this email or contact support immediately.
          </p>
        </div>
        
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #21262d; color: #6e7681; font-size: 12px;">
          &copy; ${new Date().getFullYear()} GYMGO Inc. All rights reserved.
        </div>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] OTP email dispatched to ${toEmail}. Response:`, info.messageId || info.response);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[EmailService] 🔗 Ethereal Email Web Preview: ${previewUrl}`);
  }

  return info;
}
