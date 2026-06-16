import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import iocService from '../services/ioc.service';
import { sendSuccess, sendError, sendCreated, sendNoContent, paginate } from '../utils/helpers';
import fs from 'fs';
import csvParser from 'csv-parser';

export class IOCController {
  async getIOCs(req: AuthRequest, res: Response) {
    try {
      const { skip = 0, take = 25, type, severity, status, search } = req.query;
      const { limit, offset } = paginate(Number(skip), Number(take));

      const result = await iocService.getIOCs(
        { type, severity, status, search },
        offset,
        limit
      );

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getIOCById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const ioc = await iocService.getIOCById(id);
      sendSuccess(res, ioc);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async createIOC(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, 'Unauthorized', 401);
      }

      const ioc = await iocService.createIOC(req.body, req.user.userId);
      sendCreated(res, ioc, 'IOC created successfully');
    } catch (error: any) {
      sendError(res, error.message, error.message.includes('already exists') ? 409 : 400);
    }
  }

  async updateIOC(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);
      const { id } = req.params;
      const ioc = await iocService.updateIOC(id, req.body);
      sendSuccess(res, ioc, 'IOC updated successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async deleteIOC(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { hard } = req.query;
      await iocService.deleteIOC(id, hard === 'true');
      sendNoContent(res);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getIOCDistribution(req: AuthRequest, res: Response) {
    try {
      const distribution = await iocService.getIOCDistribution();
      sendSuccess(res, distribution);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getThreatActors(req: AuthRequest, res: Response) {
    try {
      const { limit = 5000 } = req.query;
      const actors = await iocService.getThreatActors(Number(limit));
      sendSuccess(res, actors);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getFreshIOCs(req: AuthRequest, res: Response) {
    try {
      const { hours = 24, limit = 100 } = req.query;
      const fresh = await iocService.getFreshIOCs(Number(hours), Number(limit));
      sendSuccess(res, fresh);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async bootstrapDiverse(req: AuthRequest, res: Response) {
    try {
      const { total = 120 } = req.body || {};
      const result = await iocService.bootstrapDiverseIOCs(Number(total));
      sendSuccess(res, result, 'Diverse IOC dataset generated');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async exportIOCs(req: AuthRequest, res: Response) {
    try {
      const { format = 'json', type, severity, status } = req.query;
      const rows = await iocService.exportIOCs({
        type: type as string | undefined,
        severity: severity as string | undefined,
        status: status as string | undefined,
      });

      if (format === 'csv') {
        const header = 'id,value,type,severity,confidence,status,tags,sources,firstSeen,lastSeen\n';
        const csv = rows.map((r) =>
          [
            r.id,
            `"${String(r.value).replace(/"/g, '""')}"`,
            r.type,
            r.severity,
            r.confidence,
            r.status,
            `"${(r.tags || []).join(';')}"`,
            `"${(r.sources || []).join(';')}"`,
            r.firstSeen,
            r.lastSeen,
          ].join(',')
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="iocs.csv"');
        return res.send(header + csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="iocs.json"');
      return res.json(rows);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async uploadCSV(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);
      if (!req.file?.path) return sendError(res, 'No CSV file uploaded', 400);
      const userId = req.user.userId;

      const MAX_CSV_ROWS = 10_000;
      const rows: any[] = [];
      let responseSent = false;

      const stream = fs.createReadStream(req.file.path).pipe(csvParser());

      stream.on('data', (data) => {
        rows.push(data);
        if (rows.length >= MAX_CSV_ROWS) stream.destroy();
      });

      stream.on('error', (err: any) => {
        if (!responseSent) {
          responseSent = true;
          const isEarlyDestroy = err.code === 'ERR_STREAM_DESTROYED';
          if (!isEarlyDestroy) sendError(res, 'CSV processing error', 400);
        }
      });

      stream.on('close', async () => {
        if (responseSent) return;
        try {
          let imported = 0;
          let skipped = 0;

          for (const row of rows) {
            const value = String(row.value || row.indicator || row.ioc || row[0] || '').trim();
            const type = String(row.type || '').trim();
            if (!value || !type) { skipped++; continue; }

            try {
              await iocService.createIOC(
                {
                  value,
                  type: type as any,
                  severity: (row.severity || 'medium') as any,
                  confidence: Number(row.confidence || 60),
                  tags: row.tags ? String(row.tags).split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : [],
                  sources: row.source ? [String(row.source)] : ['bulk-import'],
                  description: row.description || undefined,
                },
                userId
              );
              imported++;
            } catch {
              skipped++;
            }
          }

          responseSent = true;
          const truncated = rows.length >= MAX_CSV_ROWS;
          sendSuccess(res, { imported, skipped, truncated }, `Imported ${imported} IOCs`);
        } catch (err: any) {
          if (!responseSent) {
            responseSent = true;
            sendError(res, 'Import failed', 500);
          }
        }
      });
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getRelatedIOCs(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const limit = Math.min(Number(req.query.limit || 10), 50);
      const related = await iocService.getRelatedIOCs(id, limit);
      sendSuccess(res, related);
    } catch (error: any) {
      sendError(res, error.message, error.message.includes('not found') ? 404 : 500);
    }
  }

  async getAnomalies(_req: AuthRequest, res: Response) {
    try {
      const result = await iocService.getAnomalies();
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }
}

export default new IOCController();
