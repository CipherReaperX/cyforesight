import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import incidentService from '../services/incident.service';
import { sendCreated, sendError, sendSuccess } from '../utils/helpers';
import { emit, addNotification } from '../services/socket.service';

export class IncidentController {
  async list(req: AuthRequest, res: Response) {
    try {
      const { status, limit = 50 } = req.query;
      const data = await incidentService.listIncidents(status as string | undefined, Number(limit));
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async stats(req: AuthRequest, res: Response) {
    try {
      const data = await incidentService.getWorkbenchStats();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const data = await incidentService.createIncident(req.body || {});
      emit('incident:created', { id: data.id, name: data.name, severity: data.severity });
      addNotification('system', `New incident: ${data.name}`, `Severity: ${data.severity}`, { incidentId: data.id });
      sendCreated(res, data, 'Incident created');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async bootstrap(req: AuthRequest, res: Response) {
    try {
      const { limit = 120 } = req.body || {};
      const data = await incidentService.bootstrapFromHighRiskIOCs(Number(limit));
      if (data.createdCount > 0) {
        emit('incident:created', { count: data.createdCount });
      }
      sendCreated(res, data, 'Incident clusters created');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = await incidentService.getIncidentById(id);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message, 404);
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = await incidentService.updateIncident(id, req.body || {});
      emit('incident:updated', { id: data.id, status: data.status, name: data.name });
      sendSuccess(res, data, 'Incident updated');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await incidentService.deleteIncident(id);
      emit('incident:deleted', { id });
      sendSuccess(res, { id }, 'Incident deleted');
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  }
}

export default new IncidentController();
