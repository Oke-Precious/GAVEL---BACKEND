const nodemailer = require('nodemailer');
const env = require('../config/env');

class EmailService {
  constructor() {
    this.transporter = null;
    
    // Initialize standard SMTP transporter if credentials are provided
    if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_PORT == 465, // true for 465, false for other ports
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    }
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

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return info;
      } catch (error) {
        console.error(`Error sending email:`, error);
        throw new Error('Email could not be sent');
      }
    } else {
      // Fallback for development if SMTP is not configured
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
    const verificationUrl = `${env.BACKEND_URL}/api/v1/auth/verify-email/${token}`;
    
    const subject = 'GAVEL - Verify Your Email Address';
    const text = `Hello ${user.firstName},\n\nPlease verify your email address by clicking on the following link or pasting it into your browser:\n\n${verificationUrl}\n\nIf you did not request this, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to GAVEL</h2>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; margin: 20px 0; background-color: #0056b3; color: #ffffff; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Or paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>If you did not create an account, please ignore this email.</p>
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
}

module.exports = new EmailService();
