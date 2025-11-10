import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.qq.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('[EmailService] 未检测到 SMTP_USER 或 SMTP_PASSWORD，邮件发送将失败，请检查 .env 配置');
    }

    console.log('[EmailService] 使用的 SMTP 配置:', {
      host,
      port,
      secure,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    });

    // 从环境变量读取邮件配置
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // 可选：启用调试日志
    if (process.env.SMTP_DEBUG === 'true') {
      this.transporter.set('debug', true);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('邮件发送成功:', info.messageId);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  // 验证邮件配置
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('邮件服务连接验证成功');
      return true;
    } catch (error) {
      console.error('邮件服务连接验证失败:', error);
      return false;
    }
  }
}

