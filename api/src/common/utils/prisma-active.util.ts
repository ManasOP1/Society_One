/** Standard soft-delete filter — use on every tenant-scoped read unless including archived rows. */
export const activeOnly = { deletedAt: null } as const;
