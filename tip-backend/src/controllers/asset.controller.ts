import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import assetService from '../services/asset.service';
import { sendSuccess, sendError, sendCreated, sendNoContent, paginate } from '../utils/helpers';
import fs from 'fs';
import csvParser from 'csv-parser';

export class AssetController {
  async getAssets(req: AuthRequest, res: Response) {
    try {
      const { skip = 0, take = 25, type, status, search } = req.query;
      const { limit, offset } = paginate(Number(skip), Number(take));

      const result = await assetService.getAssets(
        { type, status, search },
        offset,
        limit
      );

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async getAssetById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const asset = await assetService.getAssetById(id);
      sendSuccess(res, asset);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async createAsset(req: AuthRequest, res: Response) {
    try {
      const asset = await assetService.createAsset(req.body);
      sendCreated(res, asset, 'Asset created successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async updateAsset(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const asset = await assetService.updateAsset(id, req.body);
      sendSuccess(res, asset, 'Asset updated successfully');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async deleteAsset(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await assetService.deleteAsset(id);
      sendNoContent(res);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getRiskDistribution(req: AuthRequest, res: Response) {
    try {
      const distribution = await assetService.getRiskDistribution();
      sendSuccess(res, distribution);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async bootstrapSmallEnterprise(req: AuthRequest, res: Response) {
    try {
      const result = await assetService.bootstrapSmallEnterprise();
      sendSuccess(res, result, 'Small enterprise asset architecture loaded');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getAssetVulnerabilities(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 25 } = req.query;
      const result = await assetService.getAssetVulnerabilities(id, Number(limit));
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getAssetThreats(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 25 } = req.query;
      const result = await assetService.getAssetThreats(id, Number(limit));
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async mapIOCsToAssets(req: AuthRequest, res: Response) {
    try {
      const { limitPerAsset = 40 } = req.body || {};
      const result = await assetService.mapIOCsToAssets(Number(limitPerAsset));
      sendSuccess(res, result, 'IOC-to-asset mapping completed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getExposurePriorities(req: AuthRequest, res: Response) {
    try {
      const { limit = 25 } = req.query;
      const result = await assetService.getExposurePriorities(Number(limit));
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async recheckAssetIOCsVT(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { limit = 20 } = req.body || {};
      const result = await assetService.recheckAssetIOCsWithVT(id, Number(limit));
      sendSuccess(res, result, 'Asset IOC VT recheck completed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await assetService.getStats();
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async exportAssets(req: AuthRequest, res: Response) {
    try {
      const { type, status, search } = req.query as Record<string, string>;
      const rows = await assetService.exportAssets({ type, status, search });
      const header = 'id,name,type,ip,hostname,os,department,owner,riskScore,activeThreats,unpatchedCves,status,lastScan\n';
      const csv = header + rows.map(r =>
        [r.id, r.name, r.type, r.ip ?? '', r.hostname ?? '', r.os ?? '', r.department ?? '',
         r.owner ?? '', r.riskScore ?? 0, r.activeThreats ?? 0, r.unpatchedCves ?? 0,
         r.status, r.lastScan ? new Date(r.lastScan).toISOString() : '']
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
      res.send(csv);
    } catch (error: any) {
      sendError(res, error.message);
    }
  }

  async scanAsset(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await assetService.scanAsset(id);
      sendSuccess(res, result, 'Asset scan completed');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  // === BULK ASSET CSV UPLOAD ENDPOINT ===
  async uploadCSV(req: AuthRequest, res: Response) {
    try {
      if (!req.file || !req.file.path) {
        return sendError(res, 'No CSV file uploaded', 400);
      }

      const results: any[] = [];
      fs.createReadStream(req.file.path)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          let imported = 0;
          for (const row of results) {
            try {
              // Adapt this to your schema as needed!
              await assetService.createAsset({
                name: row.name,
                hostname: row.hostname,
                ip: row.ip_address,
                type: row.type,
                os: row.os,
                tags: row.tags ? row.tags.split(';') : [],
              });
              imported++;
            } catch (e) {
              // log error silently, keep going
            }
          }
          return sendSuccess(res, { imported }, `Imported ${imported} assets from CSV`);
        });
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new AssetController();
