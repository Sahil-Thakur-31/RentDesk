import type { Request } from 'express';
import { broadcastToPortfolio, type ServerEvent } from './socketServer';

type EmitParams = {
  resource: ServerEvent['resource'];
  action: string;
  id?: string;
  data?: unknown;
  meta?: { monthKey?: string };
  portfolioId?: string;
};

const getId = (value: any) => String(value?._id || value || '');

export const emitPortfolioEvent = (req: Request, params: EmitParams) => {
  try {
    const portfolioId = params.portfolioId || getId((req as any).portfolio);
    if (!portfolioId) return;

    const event: ServerEvent = {
      type: `${params.resource}:${params.action}`,
      resource: params.resource,
      action: params.action,
      portfolioId,
      propertyId: (req as any).property?._id ? getId((req as any).property) : undefined,
      id: params.id,
      data: params.data,
      meta: params.meta
    };

    broadcastToPortfolio(portfolioId, event);
  } catch {
    // a broadcast failure must never fail the HTTP response it's attached to
  }
};
