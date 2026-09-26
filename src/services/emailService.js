const nodemailer = require('nodemailer');
const https = require('https');
const env = require('../config/env');
const { CONTACT_CATEGORY_LABELS } = require('../constants/contact');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const extractEmailDomain = value => {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match ? match[1].toLowerCase() : null;
};

const parseEmailAddress = value => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^<>@\s]+@[^<>@\s]+)>$/);

  if (match) {
    const name = match[1] ? match[1].trim() : undefined;
    return {
      email: match[2].trim(),
      ...(name ? { name } : {})
    };
  }

  return { email: raw.replace(/^"|"$/g, '') };
};

const appendTokenToUrl = (baseUrl, token) => {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  return `${normalizedBase}/${token}`;
};

class EmailService {
  constructor() {
    this.transporter = null;
    
    // Initialize SMTP/service transport when credentials and a provider are present.
    if ((env.EMAIL_HOST || env.EMAIL_SERVICE) && env.EMAIL_USER && env.EMAIL_PASS) {
      const transportOptions = {
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000
      };

      if (env.EMAIL_HOST) {
        transportOptions.host = env.EMAIL_HOST;
        transportOptions.port = Number(env.EMAIL_PORT) || 587;
        transportOptions.secure = Number(env.EMAIL_PORT) === 465;
      } else {
        transportOptions.service = env.EMAIL_SERVICE;
      }

      this.transporter = nodemailer.createTransport(transportOptions);

      const authenticatedDomain = extractEmailDomain(env.EMAIL_USER);
      const senderDomain = extractEmailDomain(env.EMAIL_FROM);
      const isKnownRelay = String(env.EMAIL_HOST || '').toLowerCase() === 'smtp-relay.brevo.com';
      if (!isKnownRelay && authenticatedDomain && senderDomain && authenticatedDomain !== senderDomain) {
        console.warn('EMAIL_FROM does not match the authenticated SMTP domain. Delivery may be rejected or treated as spoofed mail.');
      }
    }
  }

  async postJson(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const payload = JSON.stringify(body);
      const request = https.request({
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        port: parsedUrl.port || 443,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        },
        timeout: 20000
      }, response => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', chunk => {
          responseBody += chunk;
        });
        response.on('end', () => {
          let data = responseBody;
          try {
            data = responseBody ? JSON.parse(responseBody) : {};
          } catch (_) {
            // Keep the raw response text for provider errors that are not JSON.
          }

          resolve({
            statusCode: response.statusCode,
            data
          });
        });
      });

      request.on('timeout', () => {
        request.destroy(new Error('Brevo API request timed out'));
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });
  }

  async sendBrevoApiEmail(options) {
    const sender = parseEmailAddress(env.EMAIL_FROM);
    const response = await this.postJson('https://api.brevo.com/v3/smtp/email', {
      sender,
      to: [{ email: options.to }],
      subject: options.subject,
      textContent: options.text,
      htmlContent: options.html
    }, {
      'api-key': env.BREVO_API_KEY,
      Accept: 'application/json'
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error('Brevo API rejected email', {
        statusCode: response.statusCode,
        error: response.data && response.data.message
      });
      throw new Error('Email could not be sent');
    }

    console.log('Email submitted to Brevo API', {
      messageId: response.data && response.data.messageId
    });

    return {
      messageId: response.data && response.data.messageId,
      provider: 'brevo-api'
    };
  }

  /**
   * Send an email
   * @param {Object} options - Email options (to, subject, text, html)
   */
  async sendEmail(options) {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    if (env.BREVO_API_KEY) {
      return this.sendBrevoApiEmail(options);
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);

        if (Array.isArray(info.rejected) && info.rejected.length > 0) {
          console.error('SMTP rejected one or more recipients', {
            acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : 0,
            rejectedCount: info.rejected.length,
            messageId: info.messageId
          });
        }

        if (Array.isArray(info.accepted) && info.accepted.length === 0 && Array.isArray(info.rejected) && info.rejected.length > 0) {
          throw new Error('SMTP rejected all recipients');
        }

        console.log('Email submitted to SMTP provider', {
          messageId: info.messageId,
          acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : undefined,
          rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : undefined
        });
        return info;
      } catch (error) {
        console.error(`Error sending email:`, error);
        throw new Error('Email could not be sent');
      }
    } else {
      if (env.NODE_ENV === 'production') {
        throw new Error('Email transport is not configured');
      }

      // Fallback for local development if SMTP is not configured
      console.log('================ DEVELOPMENT EMAIL FALLBACK ================');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Content (Text): \n${options.text}`);
      console.log('============================================================');
      return { messageId: 'dev-fallback-id', devMode: true };
    }
  }

  /**
   * Send email verification link
   * @param {Object} user - User object
   * @param {string} token - Raw unhashed verification token
   */
  async sendVerificationEmail(user, token) {
    const verificationUrlBase = env.EMAIL_VERIFICATION_URL_BASE
      || `${env.BACKEND_URL}/api/v1/auth/verify-email`;
    const verificationUrl = appendTokenToUrl(verificationUrlBase, token);
    const firstName = escapeHtml(user.firstName || 'there');
    const safeVerificationUrl = escapeHtml(verificationUrl);
    
    const subject = 'GAVEL - Verify Your Email Address';
    const text = `Hello ${user.firstName || 'there'},\n\nWelcome to GAVEL. Please verify your email address using this link:\n${verificationUrl}\n\nThis link expires soon. If you did not create a GAVEL account, please ignore this email.`;
    const html = `
      <div style="margin:0; padding:0; background:#f3f6fb; font-family:Arial, Helvetica, sans-serif; color:#182033;">
        <div style="max-width:640px; margin:0 auto; padding:32px 16px;">
          <div style="background:#ffffff; border:1px solid #e4e9f2; border-radius:16px; overflow:hidden; box-shadow:0 18px 45px rgba(15, 23, 42, 0.08);">
            <div style="background:#0f3b66; padding:28px 32px; text-align:left;">
              <div style="font-size:26px; line-height:1; font-weight:800; letter-spacing:0.08em; color:#ffffff;">GAVEL</div>
              <div style="margin-top:10px; color:#d8e8f7; font-size:14px;">Secure access to justice services</div>
            </div>

            <div style="padding:34px 32px 28px;">
              <div style="display:inline-block; padding:7px 12px; border-radius:999px; background:#eaf4ff; color:#0f5c9d; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Email verification</div>
              <h1 style="margin:22px 0 10px; font-size:26px; line-height:1.25; color:#101828;">Welcome to GAVEL, ${firstName}</h1>
              <p style="margin:0; font-size:16px; line-height:1.7; color:#4b5565;">Your volunteer lawyer account has been created. Please confirm this email address so we can keep your account secure and complete your signup.</p>

              <div style="text-align:center; margin:32px 0;">
                <a href="${safeVerificationUrl}" style="display:inline-block; background:#0f5c9d; color:#ffffff; text-decoration:none; padding:15px 28px; border-radius:10px; font-weight:700; font-size:16px;">Verify my email</a>
              </div>

              <div style="background:#f8fafc; border:1px solid #e4e9f2; border-radius:12px; padding:16px 18px; color:#596579; font-size:14px; line-height:1.6;">
                This verification link is unique to your account. If the button does not open, request a new verification email from the login page.
              </div>

              <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#667085;">If you did not create a GAVEL account, you can safely ignore this email.</p>
            </div>

            <div style="border-top:1px solid #e4e9f2; padding:18px 32px; background:#fbfcfe; color:#8a95a8; font-size:12px; line-height:1.5;">
              This message was sent by GAVEL. Please do not reply directly to this automated email.
            </div>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({ to: user.email, subject, text, html });
  }

  /**
   * Send password reset link
   * @param {Object} user - User object
   * @param {string} token - Raw unhashed reset token
   */
  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${env.CLIENT_URL}/reset-password/${token}`;
    
    const subject = 'GAVEL - Password Reset Request';
    const text = `Hello ${user.firstName},\n\nYou requested a password reset. Please make a PUT request to: \n\n${resetUrl}\n\nThis link will expire in 10 minutes.\nIf you did not request this, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Hello ${user.firstName},</p>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin: 20px 0; background-color: #0056b3; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    return this.sendEmail({ to: user.email, subject, text, html });
  }

  /**
   * Notify the configured administrator about a persisted contact message.
   * @param {Object} contactMessage - Persisted ContactMessage document
   */
  async sendContactNotification(contactMessage) {
    if (!env.CONTACT_NOTIFICATION_EMAIL) {
      throw new Error('CONTACT_NOTIFICATION_EMAIL is not configured');
    }

    const categoryLabel = CONTACT_CATEGORY_LABELS[contactMessage.category] || contactMessage.category;
    const senderName = contactMessage.name || 'Not provided';
    const createdAt = new Date(contactMessage.createdAt).toISOString();
    const messageId = contactMessage._id.toString();
    const subject = `[GAVEL Contact] ${categoryLabel} from ${contactMessage.email}`;
    const text = [
      `Name: ${senderName}`,
      `Email: ${contactMessage.email}`,
      `Category: ${categoryLabel}`,
      `Message: ${contactMessage.message}`,
      `Created: ${createdAt}`,
      `Message ID: ${messageId}`
    ].join('\n\n');
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <h2>New GAVEL Contact Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(senderName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(contactMessage.email)}</p>
        <p><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(contactMessage.message)}</p>
        <p><strong>Created:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Message ID:</strong> ${escapeHtml(messageId)}</p>
      </div>
    `;

    return this.sendEmail({
      to: env.CONTACT_NOTIFICATION_EMAIL,
      subject,
      text,
      html
    });
  }
}

module.exports = new EmailService();
