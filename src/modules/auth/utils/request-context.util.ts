import type { Request } from 'express';

import { RequestContext } from '../interfaces/auth-tokens.interface';

/** Extracts the device fingerprint (user agent + IP) from a request. */
export function extractRequestContext(req: Request): RequestContext {
  const userAgent = req.headers['user-agent'];
  return {
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    ipAddress: req.ip,
  };
}
