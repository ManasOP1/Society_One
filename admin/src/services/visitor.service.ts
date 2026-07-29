/**
 * Visitors — backed by the live Nest API (`GET/POST/DELETE /visitors`).
 */

import { visitorsApi, notifyDataUpdated, apiErrorMessage } from "@/lib/api-client";
import { cacheKey, readAdminCache, writeAdminCache } from "@/lib/admin-cache";

export type VisitorStatus = string;

export interface SocietyVisitor {
  id: string;
  societyId: string;
  name: string;
  flat: string;
  purpose: string;
  visitType?: string;
  companyName?: string;
  vehicle: string;
  vehicleType?: string;
  vehicleNo?: string;
  expectedTime: string;
  checkInAt?: string | null;
  phone: string;
  photoUrl?: string | null;
  passNumber?: string | null;
  status: VisitorStatus;
  createdAt: string;
}

let cache: SocietyVisitor[] = [];
const loadedFor = new Set<string>();
const loadingFor = new Set<string>();

function hydrateVisitors(societyId: string) {
  if (loadedFor.has(societyId)) return;
  const persisted = readAdminCache<SocietyVisitor[]>(cacheKey("visitors", societyId));
  if (persisted?.length) {
    cache = [...cache.filter((v) => v.societyId !== societyId), ...persisted];
    loadedFor.add(societyId);
  }
}

function persistVisitors(societyId: string) {
  writeAdminCache(
    cacheKey("visitors", societyId),
    cache.filter((v) => v.societyId === societyId)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiVisitor(raw: any, societyId: string): SocietyVisitor {
  const statusRaw = String(raw?.status ?? raw?.statusCode ?? "LOGGED");
  const status =
    statusRaw === "INSIDE"
      ? "Inside"
      : statusRaw.charAt(0) + statusRaw.slice(1).toLowerCase().replace(/_/g, " ");
  return {
    id: raw?.id ?? `vs-${Date.now()}`,
    societyId,
    name: raw?.name ?? "",
    flat: raw?.flat ?? raw?.flatLabel ?? "",
    purpose: raw?.purpose ?? "",
    visitType: raw?.visitType ?? undefined,
    companyName: raw?.companyName ?? undefined,
    vehicle: raw?.vehicle || "—",
    vehicleType: raw?.vehicleType ?? undefined,
    vehicleNo: raw?.vehicleNo ?? undefined,
    expectedTime: raw?.expectedTime || "",
    checkInAt: raw?.checkInAt ?? null,
    phone: raw?.phone || "",
    photoUrl: raw?.photoUrl ?? null,
    passNumber: raw?.passNumber ?? null,
    status,
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
    persistVisitors(societyId);
    notifyDataUpdated("visitors");
  } catch (e) {
    console.error("Failed to load visitors from API:", apiErrorMessage(e));
  } finally {
    loadingFor.delete(societyId);
  }
}

export const visitorService = {
  list(societyId: string): SocietyVisitor[] {
    hydrateVisitors(societyId);
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
    persistVisitors(societyId);
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
        persistVisitors(societyId);
        notifyDataUpdated("visitors");
      })
      .catch((e) => {
        console.error("Failed to create visitor:", apiErrorMessage(e));
        cache = cache.filter((v) => v.id !== tempId);
        persistVisitors(societyId);
        notifyDataUpdated("visitors");
      });
    return optimistic;
  },

  async remove(id: string, _actor: string): Promise<void> {
    const visitor = cache.find((v) => v.id === id);
    if (!visitor) throw new Error("Visitor not found");
    if (id.startsWith("pending-")) {
      cache = cache.filter((v) => v.id !== id);
      persistVisitors(visitor.societyId);
      notifyDataUpdated("visitors");
      return;
    }
    try {
      await visitorsApi.remove(id, visitor.societyId);
      cache = cache.filter((v) => v.id !== id);
      persistVisitors(visitor.societyId);
      notifyDataUpdated("visitors");
    } catch (e) {
      await refreshList(visitor.societyId);
      throw new Error(apiErrorMessage(e));
    }
  },
};
