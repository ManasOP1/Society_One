import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/storage";
import { auditService } from "@/services/audit.service";
import type { Expense } from "@/types";

const CATEGORIES = [
  "Utilities",
  "Security",
  "Housekeeping",
  "Repairs",
  "Gardening",
  "Admin",
  "Events",
  "Other",
] as const;

function getAll(): Expense[] {
  return storageGet<Expense[]>(STORAGE_KEYS.expenses, []);
}

function saveAll(list: Expense[]) {
  storageSet(STORAGE_KEYS.expenses, list);
}

/** Drop legacy demo expenses that were auto-seeded into localStorage. */
function purgeLegacySeed(societyId: string) {
  const all = getAll();
  const cleaned = all.filter(
    (e) =>
      e.id !== `exp-${societyId}-1` &&
      e.id !== `exp-${societyId}-2` &&
      e.id !== `exp-${societyId}-3`
  );
  if (cleaned.length !== all.length) saveAll(cleaned);
}

export const expenseService = {
  categories: CATEGORIES,

  list(societyId: string): Expense[] {
    purgeLegacySeed(societyId);
    return getAll()
      .filter((e) => e.societyId === societyId)
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  },

  create(
    societyId: string,
    input: Omit<Expense, "id" | "societyId" | "createdAt">,
    actor: string
  ): Expense {
    const expense: Expense = {
      ...input,
      id: `exp-${Date.now()}`,
      societyId,
      createdAt: new Date().toISOString(),
    };
    saveAll([expense, ...getAll()]);
    auditService.log({
      societyId,
      action: "Expense Created",
      entityType: "expense",
      entityId: expense.id,
      details: `${expense.category} · ${expense.vendor} · ₹${expense.amount}`,
      actor,
    });
    return expense;
  },

  update(
    id: string,
    patch: Partial<Omit<Expense, "id" | "societyId" | "createdAt">>,
    actor: string
  ): Expense | null {
    const all = getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const next = { ...all[idx], ...patch };
    all[idx] = next;
    saveAll(all);
    auditService.log({
      societyId: next.societyId,
      action: "Expense Updated",
      entityType: "expense",
      entityId: next.id,
      details: `Updated ${next.vendor}`,
      actor,
    });
    return next;
  },

  remove(id: string, actor: string): boolean {
    const exp = getAll().find((e) => e.id === id);
    if (!exp) return false;
    saveAll(getAll().filter((e) => e.id !== id));
    auditService.log({
      societyId: exp.societyId,
      action: "Expense Deleted",
      entityType: "expense",
      entityId: id,
      details: `Deleted ${exp.vendor} ₹${exp.amount}`,
      actor,
    });
    return true;
  },

  total(societyId: string, month?: string) {
    return this.list(societyId)
      .filter((e) => !month || e.expenseDate.startsWith(month))
      .reduce((s, e) => s + e.amount, 0);
  },
};
