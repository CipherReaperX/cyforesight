import { z } from 'zod';

export const createIOCSchema = z.object({
  body: z.object({
    value: z.string().min(1, 'IOC value is required'),
    type: z.enum(['ip', 'domain', 'hash', 'url', 'email', 'registry', 'mutex', 'user-agent']),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    confidence: z.number().min(0).max(100).optional().default(50),
    tags: z.array(z.string()).optional().default([]),
    sources: z.array(z.string()).optional().default([]),
    description: z.string().optional(),
  }),
});

export const updateIOCSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
    status: z.enum(['active', 'blocked', 'whitelisted', 'archived']).optional(),
    tags: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(100).optional(),
  }),
});

export const getIOCsSchema = z.object({
  query: z.object({
    skip: z.string().optional().transform(val => parseInt(val || '0')),
    take: z.string().optional().transform(val => parseInt(val || '25')),
    type: z.enum(['ip', 'domain', 'hash', 'url', 'email', 'registry', 'mutex', 'user-agent']).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
    status: z.enum(['active', 'blocked', 'whitelisted', 'archived']).optional(),
    search: z.string().optional(),
  }),
});
