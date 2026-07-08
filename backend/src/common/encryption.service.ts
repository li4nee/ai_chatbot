import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

/**
 * AES-256-GCM encryption for customer-supplied credentials (BYOK) at rest.
 * Fails fast at boot if ENCRYPTION_KEY is missing/malformed rather than
 * surfacing a confusing error on the first encrypt/decrypt call.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private key: Buffer;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const raw = this.configService.get<string>('ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to your .env.',
      );
    }
    const key = Buffer.from(raw, 'hex');
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — got ${key.length} bytes. Generate one with \`openssl rand -hex 32\`.`,
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error('Malformed encrypted payload');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
