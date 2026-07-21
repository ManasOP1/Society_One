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

function ensureSeed(societyId: string) {
  const all = getAll();
  if (all.some((e) => e.societyId === societyId)) return;
  const seeded: Expense[] = [
    {
      id: `exp-${societyId}-1`,
      societyId,
      category: "Security",
      vendor: "SecureGuard Pvt Ltd",
      amount: 45000,
      expenseDate: "2026-07-01",
      billName: "security-july.pdf",
      remarks: "Monthly security contract",
      createdAt: new Date().toISOString(),
    },
    {
      id: `exp-${societyId}-2`,
      societyId,
      category: "Utilities",
      vendor: "MSEB",
      amount: 18500,
      expenseDate: "2026-07-05",
      billName: "electricity-july.pdf",
      remarks: "Common area electricity",
      createdAt: new Date().toISOString(),
    },
    {
      id: `exp-${societyId}-3`,
      societyId,
      category: "Housekeeping",
      vendor: "CleanPro Services",
      amount: 22000,
      expenseDate: "2026-07-03",
      billName: "hk-july.pdf",
      remarks: "Staff wages",
      createdAt: new Date().toISOString(),
    },
  ];
  saveAll([...seeded, ...all]);
}

export const expenseService = {
  categories: CATEGORIES,

  list(societyId: string): Expense[] {
    ensureSeed(societyId);
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
