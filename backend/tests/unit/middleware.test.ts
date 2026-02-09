import type { NextFunction, Request, Response } from 'express';
import { type ZodError, z } from 'zod';
import { AppError, errorHandler } from '../../src/middleware/error-handler';
import { requestIdMiddleware } from '../../src/middleware/request-id';
import { securityHeadersMiddleware } from '../../src/middleware/security-headers';

describe('Middleware', () => {
  describe('requestIdMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        headers: {},
      };
      mockRes = {
        setHeader: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should generate a request ID if not provided', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.id).toBeDefined();
      expect(typeof mockReq.id).toBe('string');
      expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', mockReq.id);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use provided request ID from header', () => {
      const providedId = 'test-request-id-123';
      mockReq.headers = { 'x-request-id': providedId };

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.id).toBe(providedId);
      expect(mockRes.setHeader).toHaveBeenCalledWith('x-request-id', providedId);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('securityHeadersMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should set all required security headers', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-DNS-Prefetch-Control', 'off');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'"
      );
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set HSTS header in production', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('errorHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        id: 'test-request-id',
        path: '/test',
        method: 'GET',
        query: {},
        body: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should handle ZodError with 400 status', () => {
      const schema = z.object({ name: z.string() });
      let zodError: ZodError | null = null;

      try {
        schema.parse({ name: 123 });
      } catch (err) {
        zodError = err as ZodError;
      }

      if (zodError === null) {
        throw new Error('Test setup failed: schema.parse did not throw a ZodError');
      }

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            requestId: 'test-request-id',
          }),
        })
      );
    });

    it('should handle AppError with custom status code', () => {
      const appError = new AppError('RESOURCE_NOT_FOUND', 'Resource not found', 404);

      errorHandler(appError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'RESOURCE_NOT_FOUND',
            message: 'Resource not found',
            requestId: 'test-request-id',
          }),
        })
      );
    });

    it('should handle generic errors with 500 status', () => {
      const genericError = new Error('Something went wrong');

      errorHandler(genericError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            requestId: 'test-request-id',
          }),
        })
      );
    });

    it('should include timestamp in error response', () => {
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.error.timestamp).toBeDefined();
      const timestamp = new Date(jsonCall.error.timestamp);
      expect(timestamp.toISOString()).toBe(jsonCall.error.timestamp);
    });

    it('should safely handle undefined req.body', () => {
      mockReq.body = undefined;
      const error = new Error('Test error');

      // Should not throw when logging
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should safely handle null req.body', () => {
      mockReq.body = null;
      const error = new Error('Test error');

      // Should not throw when logging
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should safely handle primitive req.body', () => {
      mockReq.body = 'string body';
      const error = new Error('Test error');

      // Should not throw when logging
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should safely handle circular reference in req.body', () => {
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj['self'] = circularObj;
      mockReq.body = circularObj;
      const error = new Error('Test error');

      // Should not throw when logging circular reference
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should safely handle array req.body', () => {
      mockReq.body = [1, 2, 3];
      const error = new Error('Test error');

      // Should not throw when logging
      expect(() => {
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
