import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Asset name is required'),
    type: z.enum(['server', 'workstation', 'network_device', 'cloud_resource', 'application']),
    ip: z.string().ip().optional(),
    hostname: z.string().optional(),
    os: z.string().optional(),
    osVersion: z.string().optional(),
    department: z.string().optional(),
    owner: z.string().optional(),
    criticality: z.number().min(1).max(5).optional().default(1),
    tags: z.array(z.string()).optional().default([]),
  }),
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().optional(),
    status: z.enum(['online', 'offline', 'unknown']).optional(),
    tags: z.array(z.string()).optional(),
    riskScore: z.number().min(0).max(100).optional(),
  }),
});
