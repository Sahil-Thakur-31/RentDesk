import { invalidateByTag } from './queryCache';

export type ServerEvent = {
  type: string;
  resource: string;
  action: string;
  portfolioId: string;
  propertyId?: string;
  id?: string;
  data?: unknown;
  meta?: { monthKey?: string };
};

export const handleServerEvent = (event: ServerEvent) => {
  const { resource, propertyId, meta } = event || ({} as ServerEvent);
  const monthKey = meta?.monthKey;

  switch (resource) {
    case 'property':
      invalidateByTag('property', propertyId);
      invalidateByTag('property');
      invalidateByTag('propertyOverview', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      invalidateByTag('portfolio');
      break;

    case 'unit':
      invalidateByTag('unit', propertyId);
      invalidateByTag('unitDetails', propertyId);
      invalidateByTag('propertyOverview', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'tenant':
      invalidateByTag('tenant', propertyId);
      invalidateByTag('tenantDetails', propertyId);
      invalidateByTag('unitDetails', propertyId);
      invalidateByTag('propertyOverview', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'rentRecord':
      if (monthKey) invalidateByTag('rentRecord', propertyId, monthKey);
      invalidateByTag('rentRecord', propertyId);
      invalidateByTag('unitDetails', propertyId);
      invalidateByTag('tenantDetails', propertyId);
      invalidateByTag('propertyOverview', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'utilityBill':
      if (monthKey) invalidateByTag('utilityBill', propertyId, monthKey);
      invalidateByTag('utilityBill', propertyId);
      invalidateByTag('unitDetails', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'maintenance':
      if (monthKey) invalidateByTag('maintenance', propertyId, monthKey);
      invalidateByTag('maintenance', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'payment':
      invalidateByTag('payment', propertyId);
      invalidateByTag('unitDetails', propertyId);
      invalidateByTag('tenantDetails', propertyId);
      invalidateByTag('dashboard', propertyId);
      invalidateByTag('dashboard');
      break;

    case 'portfolio':
      invalidateByTag('portfolio');
      invalidateByTag('property');
      break;

    default:
      break;
  }
};
