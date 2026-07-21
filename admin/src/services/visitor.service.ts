/**
 * Visitors — backed by the live Nest API (`GET/POST/DELETE /visitors`).
 */

import { visitorsApi, notifyDataUpdated, apiErrorMessage } from "@/lib/api-client";

export type VisitorStatus = "Logged";

export interface SocietyVisitor {
  id: string;
  societyId: string;
  name: string;
  flat: string;
  purpose: string;
  vehicle: string;
  expectedTime: string;
  phone: string;
  status: VisitorStatus;
  createdAt: string;
}

let cache: SocietyVisitor[] = [];
const loadedFor = new Set<string>();
const loadingFor = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiVisitor(raw: any, societyId: string): SocietyVisitor {
  return {
    id: raw?.id ?? `vs-${Date.now()}`,
    societyId,
    name: raw?.name ?? "",
    flat: raw?.flat ?? "",
    purpose: raw?.purpose ?? "",
    vehicle: raw?.vehicle || "—",
    expectedTime: raw?.expectedTime || "",
    phone: raw?.phone || "",
    status: "Logged",
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

async function refreshList(societyId: string): Promise<void> {
  if (loadingFor.has(societyId)) return;
  loadingFor.add(societyId);
  try {
    const rows = await visitorsApi.list(societyId);
    const mapped = rows.map((r) => mapApiVisitor(r, societyId));
    cache = [...cache.filter((v) => v.societyId !== societyId), ...mapped];
    loadedFor.add(societyId);
    notifyDataUpdated();
  } catch (e) {
    console.error("Failed to load visitors from API:", apiErrorMessage(e));
  } finally {
    loadingFor.delete(societyId);
  }
}

export const visitorService = {
  list(societyId: string): SocietyVisitor[] {
    if (!loadedFor.has(societyId)) void refreshList(societyId);
    return cache
      .filter((v) => v.societyId === societyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async reload(societyId: string): Promise<void> {
    await refreshList(societyId);
  },

  create(
    societyId: string,
    input: Omit<SocietyVisitor, "id" | "societyId" | "createdAt" | "status">,
    _actor: string
  ): SocietyVisitor {
    const tempId = `pending-${Date.now()}`;
    const optimistic: SocietyVisitor = {
      ...input,
      id: tempId,
      societyId,
      status: "Logged",
      createdAt: new Date().toISOString(),
    };
    cache = [optimistic, ...cache];
    void visitorsApi
      .create(
        {
          name: input.name,
          flat: input.flat,
          purpose: input.purpose,
          vehicle: input.vehicle,
          phone: input.phone,
          expectedTime: input.expectedTime,
        },
        societyId
      )
      .then((created) => {
        cache = cache.map((v) => (v.id === tempId ? mapApiVisitor(created, societyId) : v));
        notifyDataUpdated();
      })
      .catch((e) => {
        console.error("Failed to create visitor:", apiErrorMessage(e));
        cache = cache.filter((v) => v.id !== tempId);
        notifyDataUpdated();
      });
    return optimistic;
  },

  async remove(id: string, _actor: string): Promise<void> {
    const visitor = cache.find((v) => v.id === id);
    if (!visitor) throw new Error("Visitor not found");
    if (id.startsWith("pending-")) {
      cache = cache.filter((v) => v.id !== id);
      notifyDataUpdated();
      return;
    }
    try {
      await visitorsApi.remove(id, visitor.societyId);
      cache = cache.filter((v) => v.id !== id);
      notifyDataUpdated();
    } catch (e) {
      await refreshList(visitor.societyId);
      throw new Error(apiErrorMessage(e));
    }
  },
};
