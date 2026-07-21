export type PaginationInput = {
  page?: number;
  limit?: number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Parses optional page/limit query params with safe bounds. */
export function parsePagination(input?: PaginationInput): { skip: number; take: number; page: number; limit: number } {
  const page = Math.max(1, Number(input?.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(input?.limit) || DEFAULT_LIMIT));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** When page/limit are omitted, callers should return a plain array (backward compatible). */
export function wantsPagination(input?: PaginationInput): boolean {
  return input?.page != null || input?.limit != null;
}
