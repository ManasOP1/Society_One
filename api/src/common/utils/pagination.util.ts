/**
 * Keyset / cursor pagination + OFFSET helpers.
 * Methods: #8 #11 #26 — exact COUNT only on page mode; cursor avoids deep OFFSET.
 */

export type PaginationInput = {
  page?: number;
  limit?: number;
  /** Opaque keyset cursor from a prior response meta.nextCursor */
  cursor?: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type KeysetCursor = {
  createdAt: string; // ISO
  id: string;
};

export type OwnerKeysetCursor = {
  ownerName: string;
  id: string;
};

const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/** Default cap when clients omit page/limit — keeps Supabase/Render payloads small. */
export const RESIDENT_LIST_LIMIT = 36;
export const ADMIN_LIST_LIMIT = 200;

export function clampLimit(limit?: number, fallback = DEFAULT_LIMIT): number {
  return Math.min(MAX_LIMIT, Math.max(1, Number(limit) || fallback));
}

/** Parses optional page/limit query params with safe bounds. */
export function parsePagination(input?: PaginationInput): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, Number(input?.page) || 1);
  const limit = clampLimit(input?.limit, DEFAULT_LIMIT);
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

/**
 * Resolved take for list endpoints — always bounded even without explicit pagination.
 * Methods: #11 #26 — cap rows; #8 — do not COUNT(*) unless page-based pagination is requested.
 */
export function resolveListTake(
  input: PaginationInput | undefined,
  role: 'resident' | 'admin',
): { skip: number; take: number; paginated: boolean } {
  if (wantsPagination(input)) {
    const { skip, take } = parsePagination(input);
    return { skip, take, paginated: true };
  }
  const defaultLimit = role === 'resident' ? RESIDENT_LIST_LIMIT : ADMIN_LIST_LIMIT;
  const take = clampLimit(input?.limit, defaultLimit);
  return { skip: 0, take, paginated: false };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
  nextCursor?: string | null,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages || !!nextCursor,
    nextCursor: nextCursor ?? null,
  };
}

/** Exact COUNT only when the client asks for a page (meta.total needed). Method #8 */
export function wantsPagination(input?: PaginationInput): boolean {
  return input?.page != null && !Number.isNaN(Number(input.page));
}

/** Prefer keyset when cursor is present — method #11 */
export function wantsKeyset(input?: PaginationInput): boolean {
  return typeof input?.cursor === 'string' && input.cursor.length > 0;
}

export function encodeKeysetCursor(row: { createdAt: Date | string; id: string }): string {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  return Buffer.from(JSON.stringify({ createdAt, id: row.id }), 'utf8').toString('base64url');
}

export function decodeKeysetCursor(cursor?: string): KeysetCursor | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as KeysetCursor;
    if (!raw?.createdAt || !raw?.id) return null;
    return raw;
  } catch {
    return null;
  }
}

export function encodeOwnerKeysetCursor(row: { ownerName: string; id: string }): string {
  return Buffer.from(JSON.stringify({ ownerName: row.ownerName, id: row.id }), 'utf8').toString(
    'base64url',
  );
}

export function decodeOwnerKeysetCursor(cursor?: string): OwnerKeysetCursor | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as OwnerKeysetCursor;
    if (!raw?.ownerName || !raw?.id) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Prisma OR clause for (created_at, id) DESC keyset. */
export function createdAtIdKeysetWhere(cursor: KeysetCursor) {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

/** Prisma OR clause for (owner_name, id) ASC keyset. */
export function ownerNameIdKeysetWhere(cursor: OwnerKeysetCursor) {
  return {
    OR: [
      { ownerName: { gt: cursor.ownerName } },
      { ownerName: cursor.ownerName, id: { gt: cursor.id } },
    ],
  };
}
