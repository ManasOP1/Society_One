/**
 * Society registry — now backed by the live Nest API (GET/POST/PATCH /societies).
 *
 * The Nest `Society` model doesn't carry the demo financial aggregates
 * (societyFund, collectedThisMonth, …) or admin credentials — those are
 * filled with safe defaults / left for other live-data services (invoices,
 * members) to populate. `adminName`/`adminEmail`/`password` on
 * `CreateSocietyInput` are UI-only here: the Nest API provisions the
 * Society + default settings row, not a login account, so creating a
 * society here does NOT create a working login — pair it with a real user
 * seeded on the API side.
 */

import type { Society } from "@/data/societies";
import { societiesApi, apiErrorMessage } from "@/lib/api-client";

export type CreateSocietyInput = {
  name: string;
  address: string;
  wings: string[];
  totalFlats: number;
  adminName: string;
  adminEmail: string;
  password: string;
  registrationNo?: string;
  panNumber?: string;
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || `society-${Date.now().toString(36)}`
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApiSociety(raw: any): Society {
  const wings: string[] = Array.isArray(raw?.wings)
    ? raw.wings.map((w: { code?: string }) => w?.code).filter(Boolean)
    : [];
  return {
    id: raw?.id ?? "",
    name: raw?.name ?? "Society",
    address: raw?.address ?? "",
    wings: wings.length ? wings : ["A"],
    totalFlats: Number(raw?.totalFlats) || 0,
    occupiedFlats: Number(raw?.occupiedFlats) || 0,
    // Not modeled by the Nest Society entity — real values come from
    // members/invoices services once loaded; default to 0 rather than fake data.
    totalMembers: raw?._count?.members ?? 0,
    societyFund: 0,
    pendingMaintenance: 0,
    collectedThisMonth: 0,
    collectionTarget: 0,
    lateFeeTotal: 0,
    adminName: raw?.adminName ?? "",
    adminEmail: raw?.adminEmail ?? "",
    password: "",
    status: raw?.statusCode === "INACTIVE" ? "inactive" : "active",
    createdAt: raw?.createdAt,
    createdBy: raw?.createdBy,
  };
}

export const societyService = {
  /** All societies (active + inactive) — Super Admin only (GET /societies). */
  async list(): Promise<Society[]> {
    const rows = await societiesApi.list();
    return rows.map(mapApiSociety).sort((a, b) => a.name.localeCompare(b.name));
  },

  /** The society for the currently logged-in society admin/resident (GET /societies/me). */
  async me(): Promise<Society | null> {
    try {
      const raw = await societiesApi.me();
      return mapApiSociety(raw);
    } catch {
      return null;
    }
  },

  async getById(id: string): Promise<Society | null> {
    try {
      const raw = await societiesApi.getById(id);
      return mapApiSociety(raw);
    } catch {
      return null;
    }
  },

  async create(input: CreateSocietyInput): Promise<Society> {
    try {
      const raw = await societiesApi.create({
        name: input.name.trim(),
        slug: slugify(input.name),
        address: input.address.trim(),
        registrationNo: input.registrationNo || undefined,
        panNumber: input.panNumber || undefined,
        wings: input.wings.length ? input.wings : ["A"],
        totalFlats: input.totalFlats || 1,
      });
      return mapApiSociety(raw);
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async setStatus(id: string, status: "active" | "inactive"): Promise<Society> {
    try {
      const raw = await societiesApi.update(id, {
        status: status === "inactive" ? "INACTIVE" : "ACTIVE",
      });
      return mapApiSociety(raw);
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  /**
   * Fire-and-forget PATCH /societies/:id (name/address/registrationNo/panNumber
   * only — other Society fields aren't modeled by the Nest API). Kept
   * synchronous for call-site compatibility with the settings page.
   */
  update(
    id: string,
    patch: Partial<Pick<Society, "name" | "address">> & {
      registrationNo?: string;
      panNumber?: string;
    }
  ): void {
    void societiesApi
      .update(id, {
        name: patch.name,
        address: patch.address,
        registrationNo: patch.registrationNo,
        panNumber: patch.panNumber,
      })
      .catch((e) => console.error("Failed to update society:", apiErrorMessage(e)));
  },
};

/** Seeded Super Admin account — real login goes through POST /auth/login. */
export const SUPER_ADMIN = {
  email: "superadmin@societyone.app",
  password: "superadmin123",
  name: "Platform Super Admin",
} as const;
