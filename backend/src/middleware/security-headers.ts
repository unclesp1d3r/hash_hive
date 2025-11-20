import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set security-related HTTP headers.
 * Implements basic security best practices for API responses.
 */
export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Prevent browsers from MIME-sniffing the response
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Remove X-Powered-By header to avoid revealing technology stack
  res.removeHeader('X-Powered-By');

  // Content Security Policy for API (restrictive since this is an API, not serving HTML)
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Strict Transport Security (HSTS) - enforce HTTPS in production
  // Note: Only enable in production with proper HTTPS setup
  if (process.env['NODE_ENV'] === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};
