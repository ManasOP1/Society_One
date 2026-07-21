import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/storage";
import type { AuditLog } from "@/types";

export const auditService = {
  list(societyId?: string): AuditLog[] {
    const all = storageGet<AuditLog[]>(STORAGE_KEYS.audit, []);
    if (!societyId) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all
      .filter((l) => l.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  log(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    const entry: AuditLog = {
      ...input,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const all = storageGet<AuditLog[]>(STORAGE_KEYS.audit, []);
    storageSet(STORAGE_KEYS.audit, [entry, ...all].slice(0, 500));
    return entry;
  },
};
