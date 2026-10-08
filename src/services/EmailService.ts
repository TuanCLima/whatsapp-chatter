import crypto from 'node:crypto'

interface SendVerificationEmailParams {
  email: string
  name: string
  verificationToken: string
}

interface VerificationEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailService {
  private resendApiKey: string
  private baseUrl: string

  constructor() {
    this.resendApiKey = process.env.RESEND_API_KEY || ''
    this.baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

    if (!this.resendApiKey) {
      console.warn('RESEND_API_KEY not set. Email verification will not work.')
    }
  }

  /**
   * Generates a secure random verification token
   */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Sends a verification email using Resend
   */
  async sendVerificationEmail({
    email,
    name,
    verificationToken,
  }: SendVerificationEmailParams): Promise<VerificationEmailResult> {
    console.log('Sending verification email to:', email, this.resendApiKey)
    if (!this.resendApiKey) {
      return {
        success: false,
        error: 'Email service not configured',
      }
    }

    const verificationUrl = `${this.baseUrl}/verify-email?token=${verificationToken}`

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Verify your email address',
          html: this.getVerificationEmailHtml(name, verificationUrl),
        }),
      })

      const data = await response.json()

      console.log('Resend API response:', data)

      if (!response.ok) {
        console.error('Resend API error:', data)
        return {
          success: false,
          error: data.message || 'Failed to send email',
        }
      }

      return {
        success: true,
        messageId: data.id,
      }
    } catch (error) {
      console.error('Error sending verification email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Sends a welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    if (!this.resendApiKey) {
      return
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Welcome to WhatsApp ChatBot!',
          html: this.getWelcomeEmailHtml(name),
        }),
      })
    } catch (error) {
      console.error('Error sending welcome email:', error)
    }
  }

  /**
   * HTML template for verification email
   */
  private getVerificationEmailHtml(
    name: string,
    verificationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for signing up! Please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 30px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-weight: 600;
                        display: inline-block;
                        font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #667eea; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #999;">
              This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>© ${new Date().getFullYear()} WhatsApp ChatBot. All rights reserved.</p>
          </div>
        </body>
      </html>
    `
  }

  /**
   * HTML template for welcome email
   */
  private getWelcomeEmailHtml(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome! 🎉</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your email has been successfully verified! You're all set to start using WhatsApp ChatBot.
            </p>
            
            <h2 style="color: #667eea; font-size: 20px; margin-top: 30px;">Getting Started</h2>
            
            <ul style="font-size: 15px; line-height: 1.8;">
              <li>Configure your Twilio credentials in the dashboard</li>
              <li>Set up your WhatsApp number</li>
              <li>Customize your AI assistant settings</li>
              <li>Start chatting with your customers!</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.baseUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 30px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-weight: 600;
                        display: inline-block;
                        font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #666;">
              Need help? Feel free to reach out to our support team anytime.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>© ${new Date().getFullYear()} WhatsApp ChatBot. All rights reserved.</p>
          </div>
        </body>
      </html>
    `
  }
}
