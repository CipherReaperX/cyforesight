import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res: Response, message: string, statusCode = 500, errors?: any) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

export const sendCreated = (res: Response, data: any, message = 'Resource created') => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

export const sendNoContent = (res: Response) => {
  return res.status(204).send();
};

export const sendAccepted = (res: Response, data: any, message = 'Request accepted') => {
  return res.status(202).json({
    success: true,
    message,
    data,
  });
};

export const paginate = (skip: number = 0, take: number = 25) => {
  const limit = Math.min(take, 100); // Max 100 items per page
  const offset = Math.max(skip, 0);
  return { limit, offset };
};

export const calculateRiskLevel = (score: number): string => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

export const validateIOCFormat = (value: string, type: string): boolean => {
  const patterns: Record<string, RegExp> = {
    ip: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i,
    url: /^https?:\/\/.+/i,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    hash: /^[a-f0-9]{32,64}$/i,
    registry: /^HKEY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)(\\[^\r\n]+)?$/i,
    mutex: /^[^\r\n]{1,260}$/,
    'user-agent': /^[^\r\n]{1,512}$/,
  };

  const pattern = patterns[type];
  if (!pattern) return false;
  return pattern.test(value);
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
