import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/helpers';
import logger from '../config/logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const headerToken = req.headers.authorization?.replace('Bearer ', '');
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const token = headerToken || queryToken;

    if (!token) {
      return sendError(res, 'No token provided', 401);
    }

    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    
    return sendError(res, 'Invalid token', 401);
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Forbidden - Insufficient permissions', 403);
    }

    next();
  };
};
