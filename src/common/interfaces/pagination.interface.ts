import { SortOrder } from '../constants/app.constants';

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface IPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Return shape of every paginated service method. The response interceptor
 * detects it and lifts `meta`/`summary` into the envelope alongside `data`.
 *
 * `summary` carries aggregates computed over the entire filtered set - not
 * the current page - via a second aggregate query sharing the list's WHERE
 * clause.
 */
export interface IPaginatedResult<T, TSummary = Record<string, unknown>> {
  data: T[];
  meta: IPaginationMeta;
  summary?: TSummary;
}
