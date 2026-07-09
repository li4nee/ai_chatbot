/**
 * Rate-limit tracker functions for the chat endpoints' two-tier throttling
 * (see app.module.ts's ThrottlerModule config). Named and exported — rather
 * than inline closures in the module config — so this policy (what counts as
 * "one visitor" vs "one bot" for throttling purposes) can be unit-tested
 * directly against a fake request object, without booting the whole app.
 */

/** One visitor of one bot — falls back to IP if a session hasn't been established yet (e.g. the very first request). */
export function perVisitorTracker(req: Record<string, any>): string {
  return `${req.bot?.id}:${req.body?.sessionId || req.query?.sessionId || req.ip}`;
}

/** All of one bot's concurrent visitors share this bucket — falls back to IP if ApiKeyGuard hasn't attached a bot yet. */
export function perBotTracker(req: Record<string, any>): string {
  return req.bot?.id || req.ip;
}
