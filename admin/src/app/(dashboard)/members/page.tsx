"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Search,
  Download,
  Upload,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/auth-context";
import { auditService } from "@/services/audit.service";
import type { Member, PaymentStatus, BhkType } from "@/data/societies";
import { settingsService } from "@/services/settings.service";
import { BHK_OPTIONS, bhkLabel, defaultAmountForBhk } from "@/lib/bhk";
import type { SocietySettings } from "@/types";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type MemberRow = Member;
type FormValues = {
  flat: string;
  wing: string;
  owner: string;
  phone: string;
  email: string;
  password: string;
  parking: string;
  bhkType: BhkType;
  maintenanceAmount: number;
  maintenance: PaymentStatus;
};

const columnHelper = createColumnHelper<MemberRow>();

const statusVariant: Record<
  PaymentStatus,
  "success" | "warning" | "danger" | "info"
> = {
  Paid: "success",
  Pending: "warning",
  Failed: "danger",
  Partial: "info",
};

const PAGE_SIZE = 8;

export default function MembersPage() {
  const {
    society,
    members,
    addMember,
    updateMember,
    deleteMember,
    importMembers,
  } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [globalFilter, setGlobalFilter] = useState("");
  const [wingFilter, setWingFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "All">(
    "All"
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [viewing, setViewing] = useState<Member | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [billingSettings, setBillingSettings] = useState<SocietySettings | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      flat: "",
      wing: society?.wings[0] ?? "A",
      owner: "",
      phone: "",
      email: "",
      password: "",
      parking: "",
      bhkType: "ONE_BHK",
      maintenanceAmount: 0,
      maintenance: "Pending",
    },
  });
  const selectedBhk = watch("bhkType");

  useEffect(() => {
    if (!society) return;
    setBillingSettings(settingsService.get(society.id));
    void settingsService.fetch(society.id, { silent: true }).then(setBillingSettings);
  }, [society]);

  useEffect(() => {
    if (!showForm || !billingSettings || editing) return;
    const amount = defaultAmountForBhk(billingSettings, selectedBhk);
    if (amount > 0) setValue("maintenanceAmount", amount);
  }, [selectedBhk, billingSettings, showForm, editing, setValue]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (wingFilter !== "All" && m.wing !== wingFilter) return false;
      if (statusFilter !== "All" && m.maintenance !== statusFilter) return false;
      return true;
    });
  }, [members, wingFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setSaveError(null);
    reset({
      flat: "",
      wing: society?.wings[0] ?? "A",
      owner: "",
      phone: "",
      email: "",
      password: "",
      parking: "",
      bhkType: "ONE_BHK",
      maintenanceAmount: defaultAmountForBhk(billingSettings, "ONE_BHK"),
      maintenance: "Pending",
    });
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    setSaveError(null);
    setValue("flat", m.flat);
    setValue("wing", m.wing);
    setValue("owner", m.owner);
    setValue("phone", m.phone);
    setValue("email", m.email);
    setValue("password", "");
    setValue("parking", m.parking);
    setValue("bhkType", m.bhkType ?? "ONE_BHK");
    setValue(
      "maintenanceAmount",
      m.maintenanceAmount && m.maintenanceAmount > 0
        ? m.maintenanceAmount
        : defaultAmountForBhk(billingSettings, m.bhkType ?? "ONE_BHK")
    );
    setValue("maintenance", m.maintenance);
    setShowForm(true);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("photo", {
        header: "Photo",
        cell: (info) => (
          <Avatar className="h-9 w-9">
            <AvatarFallback>{info.getValue()}</AvatarFallback>
          </Avatar>
        ),
      }),
      columnHelper.accessor("wing", {
        header: "Wing",
        cell: (info) => (
          <span className="font-semibold text-slate-600">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("flat", {
        header: "Flat",
        cell: (info) => (
          <span className="font-semibold text-primary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("owner", { header: "Owner" }),
      columnHelper.accessor("email", {
        header: "Login email",
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("hasAppLogin", {
        header: "App login",
        cell: (info) => (
          <Badge variant={info.getValue() ? "success" : "secondary"}>
            {info.getValue() ? "Active" : "None"}
          </Badge>
        ),
      }),
      columnHelper.accessor("phone", { header: "Phone" }),
      columnHelper.accessor("parking", { header: "Parking" }),
      columnHelper.accessor("bhkType", {
        header: "BHK",
        cell: (info) => bhkLabel(info.getValue()),
      }),
      columnHelper.accessor("maintenanceAmount", {
        header: "Monthly ₹",
        cell: (info) => {
          const v = info.getValue();
          return v != null && v > 0
            ? `₹${v.toLocaleString("en-IN")}`
            : "Not set";
        },
      }),
      columnHelper.accessor("maintenance", {
        header: "Maintenance",
        cell: (info) => (
          <Badge variant={statusVariant[info.getValue()] ?? "secondary"}>
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="View"
              onClick={() => setViewing(row.original)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              title="Delete"
              onClick={() => {
                if (
                  confirm(
                    `Delete member ${row.original.owner} (${row.original.wing}-${row.original.flat})?`
                  )
                ) {
                  void deleteMember(row.original.id).then((err) => {
                    if (err) {
                      alert(err);
                      return;
                    }
                    if (society) {
                      auditService.log({
                        societyId: society.id,
                        action: "Member Deleted",
                        entityType: "member",
                        entityId: row.original.id,
                        details: `${row.original.wing}-${row.original.flat} ${row.original.owner}`,
                        actor,
                      });
                    }
                  });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deleteMember, society, actor]
  );

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const onSave = async (values: FormValues) => {
    const payload: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin"> = {
      flat: values.flat.trim(),
      wing: values.wing,
      owner: values.owner.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      password: values.password?.trim() || undefined,
      parking: values.parking.trim(),
      bhkType: values.bhkType,
      maintenanceAmount: Number(values.maintenanceAmount) || 0,
      maintenance: values.maintenance,
    };

    if (!editing && !payload.password) {
      setSaveError("App password is required for new members.");
      return;
    }
    if ((payload.maintenanceAmount ?? 0) <= 0) {
      setSaveError(
        "Enter a monthly maintenance amount greater than 0 (set BHK defaults in Settings → Maintenance rules)."
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    const err = editing
      ? await updateMember(editing.id, payload)
      : await addMember(payload);

    setSaving(false);

    if (err) {
      setSaveError(err);
      return;
    }

    if (society) {
      auditService.log({
        societyId: society.id,
        action: editing ? "Member Updated" : "Member Created",
        entityType: "member",
        entityId: editing?.id ?? values.flat,
        details: `${values.wing}-${values.flat} ${values.owner}`,
        actor,
      });
    }

    reset();
    setEditing(null);
    setShowForm(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        Wing: "A",
        Flat: "101",
        Owner: "Sample Owner",
        Phone: "9876543210",
        Email: "owner@email.com",
        Password: "resident123",
        BHK: "1 BHK",
        "Maintenance Amount": 2500,
        Parking: "P-01",
        Maintenance: "Pending",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `${society?.name ?? "society"}-members-template.xlsx`);
  };

  const onImportFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    const mapped = rows
      .map((r) => ({
        wing: String(r.Wing ?? r.wing ?? "").trim(),
        flat: String(r.Flat ?? r.flat ?? "").trim(),
        owner: String(r.Owner ?? r.owner ?? "").trim(),
        phone: String(r.Phone ?? r.phone ?? "").trim(),
        email: String(r.Email ?? r.email ?? "").trim(),
        password: String(r.Password ?? r.password ?? "").trim(),
        parking: String(r.Parking ?? r.parking ?? "").trim(),
        bhkType: (() => {
          const raw = String(r.BHK ?? r.bhk ?? r.bhkType ?? "ONE_BHK").trim();
          if (/^1/i.test(raw) || raw === "ONE_BHK") return "ONE_BHK" as BhkType;
          if (/^2/i.test(raw) || raw === "TWO_BHK") return "TWO_BHK" as BhkType;
          if (/^3/i.test(raw) || raw === "THREE_BHK") return "THREE_BHK" as BhkType;
          return "ONE_BHK" as BhkType;
        })(),
        maintenanceAmount:
          Number(r["Maintenance Amount"] ?? r.maintenanceAmount ?? 0) || 0,
        maintenance: (String(
          r.Maintenance ?? r.maintenance ?? "Pending"
        ).trim() || "Pending") as PaymentStatus,
      }))
      .filter((r) => r.flat && r.owner && r.email && r.password);
    const count = importMembers(mapped);
    if (society) {
      auditService.log({
        societyId: society.id,
        action: "Members Imported",
        entityType: "member",
        entityId: society.id,
        details: `Imported ${count} members from Excel`,
        actor,
      });
    }
    setImportMsg(`Imported ${count} members into ${society?.name}.`);
  };

  const exportMembers = () => {
    const rows = members.map((m) => ({
      Wing: m.wing,
      Flat: m.flat,
      Owner: m.owner,
      Phone: m.phone,
      Email: m.email,
      BHK: bhkLabel(m.bhkType),
      "Maintenance Amount": m.maintenanceAmount ?? "",
      Parking: m.parking,
      Maintenance: m.maintenance,
      AppLogin: m.hasAppLogin ? "Yes" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `${society?.name ?? "society"}-members.xlsx`);
  };

  if (!society) return null;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Members"
        description={`${members.length} members · ${society.occupiedFlats}/${society.totalFlats} flats · Wings: ${society.wings.join(", ")}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> Import Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Member
            </Button>
          </>
        }
      />

      {importMsg && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {importMsg}
        </p>
      )}

      {showForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{editing ? "Edit member" : "Create member"}</CardTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
                setSaveError(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSave)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Wing</label>
                <select
                  className="flex h-10 w-full rounded-2xl border border-input bg-card px-3 text-sm"
                  {...register("wing", { required: true })}
                >
                  {society.wings.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Flat</label>
                <Input {...register("flat", { required: true })} placeholder="203" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Owner</label>
                <Input {...register("owner", { required: true })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                <Input
                  {...register("phone", {
                    required: true,
                    minLength: 10,
                  })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Login email
                </label>
                <Input
                  type="email"
                  {...register("email", { required: true })}
                  placeholder="resident@email.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {editing ? "Reset app password (optional)" : "App password"}
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...register("password", {
                    required: !editing,
                    minLength: editing ? undefined : 6,
                  })}
                  placeholder={editing ? "Leave blank to keep current" : "Min 6 characters"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Parking</label>
                <Input {...register("parking")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Flat type (BHK)
                </label>
                <select
                  className="flex h-10 w-full rounded-2xl border border-input bg-card px-3 text-sm"
                  {...register("bhkType", { required: true })}
                  onChange={(e) => {
                    const v = e.target.value as BhkType;
                    setValue("bhkType", v);
                    const amount = defaultAmountForBhk(billingSettings, v);
                    if (amount > 0) setValue("maintenanceAmount", amount);
                  }}
                >
                  {BHK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Monthly maintenance (₹)
                </label>
                <Input
                  type="number"
                  min={0}
                  {...register("maintenanceAmount", {
                    required: true,
                    valueAsNumber: true,
                    min: 0,
                  })}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used when generating invoices for this flat.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Maintenance
                </label>
                <select
                  className="flex h-10 w-full rounded-2xl border border-input bg-card px-3 text-sm"
                  {...register("maintenance")}
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 space-y-2">
                {saveError && (
                  <p className="text-sm font-medium text-destructive">{saveError}</p>
                )}
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Update member"
                      : "Save member"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            All Members ({table.getFilteredRowModel().rows.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                fieldSize="filter"
                className="w-full pl-9 sm:w-56"
              />
            </div>
            <NativeSelect
              fieldSize="filter"
              value={wingFilter}
              onChange={(e) => setWingFilter(e.target.value)}
            >
              <option value="All">All wings</option>
              {society.wings.map((w) => (
                <option key={w} value={w}>
                  Wing {w}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              fieldSize="filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PaymentStatus | "All")
              }
            >
              <option value="All">All status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Failed">Failed</option>
            </NativeSelect>
            <Button variant="outline" size="sm" onClick={exportMembers}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors hover:bg-secondary/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.getRowModel().rows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No members match this filter. Add via form or import Excel.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                {viewing.wing}-{viewing.flat}
              </CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setViewing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Owner:</span>{" "}
                {viewing.owner}
              </p>
              <p>
                <span className="text-muted-foreground">Login email:</span>{" "}
                {viewing.email}
              </p>
              <p>
                <span className="text-muted-foreground">App login:</span>{" "}
                {viewing.hasAppLogin ? "Active" : "Not provisioned"}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span>{" "}
                {viewing.phone}
              </p>
              <p>
                <span className="text-muted-foreground">Parking:</span>{" "}
                {viewing.parking}
              </p>
              <p>
                <span className="text-muted-foreground">BHK:</span>{" "}
                {bhkLabel(viewing.bhkType)}
              </p>
              <p>
                <span className="text-muted-foreground">Monthly maintenance:</span>{" "}
                {viewing.maintenanceAmount
                  ? `₹${viewing.maintenanceAmount.toLocaleString("en-IN")}`
                  : "—"}
              </p>
              <div>
                <span className="text-muted-foreground">Maintenance:</span>{" "}
                <Badge variant={statusVariant[viewing.maintenance]}>
                  {viewing.maintenance}
                </Badge>
              </div>
              <Button
                className="mt-2"
                size="sm"
                onClick={() => {
                  openEdit(viewing);
                  setViewing(null);
                }}
              >
                Edit
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
