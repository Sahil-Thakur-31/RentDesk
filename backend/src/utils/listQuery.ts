import type { Model, PipelineStage } from 'mongoose';
import { getSingleValue } from './request';

export interface ListQueryParams {
  page?: number;
  limit: number;
  search?: string;
  sortKey?: string;
  sortDir: 'asc' | 'desc';
}

export const parseListQuery = (query: Record<string, any>, defaultLimit = 10): ListQueryParams => {
  const rawPage = getSingleValue(query.page);
  const rawLimit = getSingleValue(query.limit);
  const rawSearch = getSingleValue(query.search);
  const rawSortKey = getSingleValue(query.sortKey);
  const rawSortDir = getSingleValue(query.sortDir);

  const parsedPage = rawPage != null ? parseInt(String(rawPage), 10) : NaN;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined;

  const parsedLimit = rawLimit != null ? parseInt(String(rawLimit), 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, parsedLimit) : defaultLimit;

  const search = rawSearch ? String(rawSearch).trim() : undefined;
  const sortKey = rawSortKey ? String(rawSortKey) : undefined;
  const sortDir: 'asc' | 'desc' = rawSortDir === 'desc' ? 'desc' : 'asc';

  return { page, limit, search, sortKey, sortDir };
};

export const isPaginatedRequest = (params: ListQueryParams) => params.page != null;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const buildPaginatedResult = <T>(data: T[], total: number, params: ListQueryParams): PaginatedResult<T> => ({
  data,
  total,
  page: params.page || 1,
  limit: params.limit,
  pages: Math.max(1, Math.ceil(total / params.limit))
});

export const runPaginatedAggregate = async <T>(
  model: Model<any>,
  pipeline: PipelineStage[],
  params: ListQueryParams
): Promise<{ data: T[]; total: number }> => {
  const skip = ((params.page || 1) - 1) * params.limit;
  const result = await model.aggregate([
    ...pipeline,
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: params.limit }],
        totalCount: [{ $count: 'count' }]
      }
    }
  ]);
  const data = (result[0]?.data || []) as T[];
  const total = result[0]?.totalCount?.[0]?.count || 0;
  return { data, total };
};

export const buildSearchRegexStage = (fields: string[], search?: string) => {
  if (!search) return null;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    $or: fields.map((field) => ({ [field]: { $regex: escaped, $options: 'i' } }))
  };
};
