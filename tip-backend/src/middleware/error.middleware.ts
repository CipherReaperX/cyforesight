import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { sendError } from '../utils/helpers';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 400, err.errors);
  }

  if (err.name === 'UnauthorizedError') {
    return sendError(res, 'Unauthorized', 401);
  }

  if (err.code === '23505') { // Postgres unique violation
    return sendError(res, 'Resource already exists', 409);
  }

  if (err.code === '23503') { // Postgres foreign key violation
    return sendError(res, 'Referenced resource not found', 404);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};

export const notFoundHandler = (req: Request, res: Response) => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
};
