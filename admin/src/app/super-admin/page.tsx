"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { SuperAdminGuard } from "@/components/layout/auth-guard";
import {
  societyService,
  type CreateSocietyInput,
} from "@/services/society.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const emptyForm: CreateSocietyInput = {
  name: "",
  address: "",
  wings: ["A", "B"],
  totalFlats: 50,
  adminName: "",
  adminEmail: "",
  password: "admin123",
  registrationNo: "",
  panNumber: "",
};

function SuperAdminDashboard() {
  const { societies, refreshSocieties, superAdminName, logout } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateSocietyInput>(emptyForm);
  const [wingsText, setWingsText] = useState("A, B");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return societies;
    return societies.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.adminEmail.toLowerCase().includes(q)
    );
  }, [societies, query]);

  const stats = useMemo(() => {
    const active = societies.filter((s) => s.status !== "inactive").length;
    const flats = societies.reduce((n, s) => n + s.totalFlats, 0);
    return { total: societies.length, active, flats };
  }, [societies]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const onCreate = async () => {
    setError(null);
    if (!form.name.trim() || !form.adminEmail.trim() || !form.adminName.trim()) {
      setError("Name, admin name, and admin email are required");
      return;
    }
    try {
      const wings = wingsText
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
      const created = await societyService.create({
        ...form,
        wings: wings.length ? wings : ["A"],
        totalFlats: Number(form.totalFlats) || 1,
      });
      refreshSocieties();
      setShowCreate(false);
      setForm(emptyForm);
      setWingsText("A, B");
      flash(
        `Created “${created.name}”. Note: this provisions the society record only — create the admin login separately.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create society");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">SocietyOne</p>
            <p className="text-xs text-slate-500">Super Admin · {superAdminName}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              router.replace("/super-admin/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Societies</h1>
            <p className="text-sm text-slate-500">
              {stats.total} total · {stats.active} active · {stats.flats} flats
            </p>
          </div>
          <Button
            onClick={() => {
              setError(null);
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Create society
          </Button>
        </div>

        {toast && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {toast}
          </p>
        )}

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-700">
              Directory ({filtered.length})
            </p>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 pl-9"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Society</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Flats</th>
                  <th className="px-4 py-3 font-medium">Collection</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const inactive = s.status === "inactive";
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.address}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{s.adminName}</p>
                        <p className="text-xs text-slate-500">{s.adminEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.totalFlats}</td>
                      <td className="px-4 py-3 text-slate-500">—</td>
                      <td className="px-4 py-3">
                        <Badge variant={inactive ? "secondary" : "success"}>
                          {inactive ? "Inactive" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await societyService.setStatus(
                                s.id,
                                inactive ? "active" : "inactive"
                              );
                              refreshSocieties();
                              flash(
                                inactive
                                  ? `${s.name} activated`
                                  : `${s.name} deactivated`
                              );
                            } catch (e) {
                              flash(
                                e instanceof Error
                                  ? e.message
                                  : "Failed to update status"
                              );
                            }
                          }}
                        >
                          {inactive ? "Activate" : "Deactivate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="py-10 text-center text-sm text-slate-500">
                No societies found.
              </p>
            )}
          </div>
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Create society
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Society name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Address
                </label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Wings (comma)
                  </label>
                  <Input
                    value={wingsText}
                    onChange={(e) => setWingsText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Total flats
                  </label>
                  <Input
                    type="number"
                    value={form.totalFlats}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        totalFlats: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Admin name
                </label>
                <Input
                  value={form.adminName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, adminName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Admin email
                </label>
                <Input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, adminEmail: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Password
                </label>
                <Input
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Registration No.
                  </label>
                  <Input
                    value={form.registrationNo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        registrationNo: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    PAN
                  </label>
                  <Input
                    value={form.panNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, panNumber: e.target.value }))
                    }
                  />
                </div>
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button className="w-full" onClick={onCreate}>
                Create society
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <SuperAdminGuard>
      <SuperAdminDashboard />
    </SuperAdminGuard>
  );
}
