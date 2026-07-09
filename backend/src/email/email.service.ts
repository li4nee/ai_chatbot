import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    // Email is optional infra, same as the other BYOK integrations — degrade to
    // a logged no-op rather than crashing boot when it isn't configured.
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not configured — skipping email to ${to} ("${subject}")`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.send(
      to,
      'Reset your password',
      `<p>Someone requested a password reset for this account.</p>
       <p><a href="${resetLink}">Click here to reset your password</a>. This link expires in 1 hour.</p>
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    );
  }
}
