import nodemailer from 'nodemailer';

/**
 * Creates and returns an active Nodemailer transporter based on .env config.
 */
async function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (user && pass && user.trim() !== '' && pass.trim() !== '') {
    console.log(`[EmailService] Creating active SMTP transporter for ${user} via ${host}:${port}`);
    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: { user: user.trim(), pass: pass.trim() },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Fallback: Try Ethereal test account if no user/pass in env
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

  console.log(`\n========================================\n📩 OTP DISPATCH TO: ${toEmail}\n🔑 OTP CODE: ${otpCode}\n========================================\n`);

  const info = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] OTP email dispatched to ${toEmail}. Response:`, info.messageId || info.response);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[EmailService] 🔗 Ethereal Test Inbox Link: ${previewUrl}`);
  }

  return info;
}

/**
 * Send welcome email to newly registered user.
 * @param {string} toEmail 
 * @param {string} userName 
 * @param {string} role 
 */
export async function sendWelcomeEmail(toEmail, userName = 'Member', role = 'CUSTOMER') {
  try {
    const transporter = await getTransporter();
    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || '"GYMGO Support" <no-reply@gymconnect.com>';

    const roleTitle = role === 'GYM_OWNER' ? 'Gym Owner' : role === 'EMPLOYEE' ? 'Support Staff' : 'Member';

    const mailOptions = {
      from: senderEmail,
      to: toEmail,
      subject: `🎉 Welcome to GYMGO, ${userName}!`,
      text: `Hello ${userName},\n\nWelcome to GYMGO as a ${roleTitle}! Your account has been successfully created.\n\nBest regards,\nGYMGO Team`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; background: #0b0d10; color: #f0f6fc; border-radius: 12px; border: 1px solid #21262d;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #30363d;">
            <h1 style="color: #00ffcc; margin: 0; font-size: 28px; letter-spacing: 1px;">🏋️ GYMGO</h1>
            <p style="color: #8b949e; font-size: 13px; margin-top: 6px;">Jaipur's Premium Fitness Circle</p>
          </div>
          
          <div style="padding: 25px 0;">
            <h3 style="color: #ffffff; margin-top: 0; font-size: 20px;">Welcome to GYMGO, ${userName}!</h3>
            <p style="color: #c9d1d9; font-size: 15px; line-height: 1.6;">
              Thank you for registering your account on GYMGO as a <strong style="color: #00ffcc;">${roleTitle}</strong>.<br/>
              Your registered email address is: <strong style="color: #ffffff;">${toEmail}</strong>.
            </p>
            
            <div style="background: rgba(0, 255, 204, 0.08); border: 1.5px solid #00ffcc; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #00ffcc; font-weight: 600; margin: 0; font-size: 16px;">🚀 Account Ready!</p>
              <p style="color: #8b949e; font-size: 13px; margin-top: 5px;">Log in anytime to explore gyms, memberships, store products, and manage your dashboard.</p>
            </div>
          </div>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #21262d; color: #6e7681; font-size: 12px;">
            &copy; ${new Date().getFullYear()} GYMGO Inc. All rights reserved.
          </div>
        </div>
      `
    };

    console.log(`\n========================================\n📩 WELCOME EMAIL DISPATCH TO: ${toEmail}\n========================================\n`);

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Welcome email dispatched to ${toEmail}. Response:`, info.messageId || info.response);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailService] 🔗 Ethereal Test Inbox Link: ${previewUrl}`);
    }

    return info;
  } catch (err) {
    console.error(`[EmailService ERROR] Failed to send welcome email to ${toEmail}:`, err.message);
  }
}

/**
 * Send login notification email to user upon successful sign-in.
 * @param {string} toEmail 
 * @param {string} userName 
 * @param {string} role 
 */
export async function sendLoginNotificationEmail(toEmail, userName = 'Member', role = 'CUSTOMER') {
  try {
    const transporter = await getTransporter();
    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || '"GYMGO Support" <no-reply@gymconnect.com>';

    const loginTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });

    const mailOptions = {
      from: senderEmail,
      to: toEmail,
      subject: `🔔 GYMGO Login Alert - Account Accessed`,
      text: `Hello ${userName},\n\nWe detected a successful login to your GYMGO account (${toEmail}) on ${loginTime}.\n\nRole Access: ${role}\n\nIf this was you, no action is needed.\n\nBest regards,\nGYMGO Security Team`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; background: #0b0d10; color: #f0f6fc; border-radius: 12px; border: 1px solid #21262d;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #30363d;">
            <h1 style="color: #00ffcc; margin: 0; font-size: 28px; letter-spacing: 1px;">🏋️ GYMGO</h1>
            <p style="color: #8b949e; font-size: 13px; margin-top: 6px;">Security & Account Alert</p>
          </div>
          
          <div style="padding: 25px 0;">
            <h3 style="color: #ffffff; margin-top: 0; font-size: 20px;">Successful Account Login</h3>
            <p style="color: #c9d1d9; font-size: 15px; line-height: 1.6;">
              Hello <strong style="color: #ffffff;">${userName}</strong>,<br/>
              Your GYMGO account (<strong style="color: #00ffcc;">${toEmail}</strong>) was logged into successfully.
            </p>
            
            <div style="background: rgba(255, 255, 255, 0.05); border-left: 4px solid #00ffcc; border-radius: 4px; padding: 15px; margin: 20px 0;">
              <p style="color: #ffffff; font-weight: 600; margin: 0;">📅 Date & Time: ${loginTime}</p>
              <p style="color: #8b949e; font-size: 13px; margin: 5px 0 0 0;">Role Access: ${role}</p>
            </div>
            
            <p style="color: #8b949e; font-size: 13px;">
              🔒 If this was you, you can safely ignore this email. If you did not log in, please reset your password immediately.
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #21262d; color: #6e7681; font-size: 12px;">
            &copy; ${new Date().getFullYear()} GYMGO Security Team
          </div>
        </div>
      `
    };

    console.log(`\n========================================\n📩 LOGIN NOTIFICATION DISPATCH TO: ${toEmail}\n========================================\n`);

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Login notification dispatched to ${toEmail}. Response:`, info.messageId || info.response);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailService] 🔗 Ethereal Test Inbox Link: ${previewUrl}`);
    }

    return info;
  } catch (err) {
    console.error(`[EmailService ERROR] Failed to send login notification email to ${toEmail}:`, err.message);
  }
}
