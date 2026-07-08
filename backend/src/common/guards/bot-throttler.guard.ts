import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Keys rate limiting by bot API key instead of IP (when ApiKeyGuard has attached
 * `req.bot`), so a single bot can't be hammered by rotating source IPs, and
 * shared-IP callers (office NAT, corporate proxy) aren't throttled together.
 */
@Injectable()
export class BotThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.bot?.id ?? (await super.getTracker(req));
  }
}
