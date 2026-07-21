"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Building2,
  FileText,
  CreditCard,
  MessageSquare,
  ScrollText,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { PageTransition, FadeIn } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { settingsService } from "@/services/settings.service";
import { invoiceService } from "@/services/invoice.service";
import { auditService } from "@/services/audit.service";
import { whatsappService } from "@/services/whatsapp.service";
import { prepareSocietyLogo } from "@/utils/image-upload";
import { notifyDataUpdated } from "@/lib/api-client";
import type { AuditLog, SocietySettings, WhatsAppLog } from "@/types";

const tabs = [
  { id: "society", label: "Society & billing", icon: Building2 },
  { id: "rules", label: "Maintenance rules", icon: FileText },
  { id: "whatsapp", label: "WhatsApp log", icon: MessageSquare },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "integrations", label: "Integrations", icon: CreditCard },
];

function syncInvoiceBranding(societyId: string, next: SocietySettings) {
  invoiceService.syncSocietyBranding(societyId, {
    societyName: next.societyName,
    societyAddress: next.address,
    registrationNo: next.registrationNo,
    panNumber: next.panNumber,
  });
}

export default function SettingsPage() {
  const { society, refreshSociety } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [active, setActive] = useState("society");
  const [settings, setSettings] = useState<SocietySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);

  useEffect(() => {
    if (!society) return;
    setLoading(true);
    void settingsService
      .fetch(society.id)
      .then((data) => {
        setSettings(data);
        setLogoError(null);
      })
      .catch((error) => {
        setLogoError(
          error instanceof Error ? error.message : "Could not load settings."
        );
      })
      .finally(() => setLoading(false));
    setAudit(auditService.list(society.id));
    setWaLogs(whatsappService.list(society.id));
  }, [society]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const persistSettings = async (patch: Partial<SocietySettings>) => {
    if (!society) return null;
    const next = await settingsService.update(society.id, patch, actor);
    syncInvoiceBranding(society.id, next);
    if (next.invoicesSynced) {
      void invoiceService.reload(society.id);
    }
    notifyDataUpdated();
    await refreshSociety();
    return next;
  };

  const saveSettings = async (
    patch: Partial<SocietySettings>,
    successMessage = "Settings saved"
  ) => {
    if (!society || !settings) return;
    setSaving(true);
    setLogoError(null);
    try {
      const next = await persistSettings(patch);
      if (!next) return;
      setSettings(next);
      setAudit(auditService.list(society.id));
      const synced = next.invoicesSynced ?? 0;
      flash(
        synced > 0
          ? `${successMessage}. ${synced} open invoice(s) updated from rules.`
          : successMessage
      );
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Could not save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file || !society) return;
    setLogoError(null);
    setSaving(true);
    try {
      const logoDataUrl = await prepareSocietyLogo(file);
      const next = await persistSettings({ logoDataUrl });
      if (!next) return;
      setSettings(next);
      flash(`Logo saved for ${next.societyName}`);
    } catch (error) {
      setLogoError(
        error instanceof Error
          ? error.message
          : "Logo upload failed — try a smaller image."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!society) return;
    setLogoError(null);
    setSaving(true);
    try {
      const next = await persistSettings({ logoDataUrl: "" });
      if (!next) return;
      setSettings(next);
      flash("Logo removed");
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : "Could not remove logo."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!society || loading) {
    return (
      <PageTransition>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <>
              <p className="text-sm text-destructive">
                {logoError ?? "Could not load settings."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!society) return;
                  setLoading(true);
                  void settingsService
                    .fetch(society.id)
                    .then((data) => {
                      setSettings(data);
                      setLogoError(null);
                    })
                    .catch((error) => {
                      setLogoError(
                        error instanceof Error
                          ? error.message
                          : "Could not load settings."
                      );
                    })
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </Button>
            </>
          )}
        </div>
      </PageTransition>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Admin Settings"
        description="Society profile, billing rules, and invoice branding"
      />

      {toast && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {toast}
        </p>
      )}

      {logoError && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {logoError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <FadeIn delay={0.05} className="lg:col-span-1">
          <Card>
            <CardContent className="space-y-1 p-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActive(tab.id);
                    if (tab.id === "whatsapp") {
                      setWaLogs(whatsappService.list(society.id));
                    }
                    if (tab.id === "audit") {
                      setAudit(auditService.list(society.id));
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium transition-all",
                    active === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {tabs.find((t) => t.id === active)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {active === "society" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Society Name
                    </label>
                    <Input
                      value={settings.societyName}
                      onChange={(e) =>
                        setSettings({ ...settings, societyName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Logo fallback text
                    </label>
                    <Input
                      value={settings.logoText}
                      onChange={(e) =>
                        setSettings({ ...settings, logoText: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Society logo
                    </label>
                    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 sm:flex-row sm:items-center">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                        {settings.logoDataUrl ? (
                          <Image
                            src={settings.logoDataUrl}
                            alt={`${settings.societyName} logo`}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <span className="text-sm font-bold tracking-widest text-muted-foreground">
                            {settings.logoText.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          Invoice logo for this society
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          PNG, JPG or WebP up to 5 MB. Shown on the top-left of
                          invoices for <strong>{settings.societyName}</strong>{" "}
                          only. After upload, open an invoice for this same
                          society to verify.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <label className="cursor-pointer">
                              <ImagePlus className="h-4 w-4" />
                              {settings.logoDataUrl
                                ? "Replace logo"
                                : "Upload logo"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(event) => {
                                  void handleLogoUpload(
                                    event.target.files?.[0]
                                  );
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </Button>
                          {settings.logoDataUrl && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={removeLogo}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                        {logoError && (
                          <p className="mt-2 text-xs font-medium text-destructive">
                            {logoError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Registration No.
                    </label>
                    <Input
                      value={settings.registrationNo}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          registrationNo: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      PAN Number
                    </label>
                    <Input
                      value={settings.panNumber}
                      onChange={(e) =>
                        setSettings({ ...settings, panNumber: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Address
                    </label>
                    <Input
                      value={settings.address}
                      onChange={(e) =>
                        setSettings({ ...settings, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Invoice prefix
                    </label>
                    <Input
                      value={settings.invoicePrefix}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoicePrefix: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Receipt prefix
                    </label>
                    <Input
                      value={settings.receiptPrefix}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          receiptPrefix: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Bank name
                    </label>
                    <Input
                      value={settings.bankName}
                      onChange={(e) =>
                        setSettings({ ...settings, bankName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Account number
                    </label>
                    <Input
                      value={settings.bankAccount}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          bankAccount: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      IFSC
                    </label>
                    <Input
                      value={settings.bankIfsc}
                      onChange={(e) =>
                        setSettings({ ...settings, bankIfsc: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      UPI ID
                    </label>
                    <Input
                      value={settings.upiId}
                      onChange={(e) =>
                        setSettings({ ...settings, upiId: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      className="mt-2"
                      disabled={saving}
                      onClick={() => void saveSettings(settings)}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}

              {active === "rules" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Default maintenance by BHK (₹/month)
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          1 BHK
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.maintenanceAmount1Bhk ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              maintenanceAmount1Bhk: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          2 BHK
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.maintenanceAmount2Bhk ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              maintenanceAmount2Bhk: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          3 BHK
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.maintenanceAmount3Bhk ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              maintenanceAmount3Bhk: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pre-fills the amount when adding a member; each flat can
                      override this.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Fallback maintenance (no BHK set)
                    </label>
                    <Input
                      type="number"
                      value={settings.maintenanceAmount}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          maintenanceAmount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Late Fee (after due date)
                    </label>
                    <Input
                      type="number"
                      value={settings.lateFeeAmount}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          lateFeeAmount: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Due Date (day of month)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={settings.dueDay}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          dueDay: Number(e.target.value) || 10,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Invoice note
                    </label>
                    <Input
                      value={settings.gstNote}
                      onChange={(e) =>
                        setSettings({ ...settings, gstNote: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Society-wide charges (added to each invoice)
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Municipal dues
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.municipalDues ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              municipalDues: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Admin & general expenses
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.adminExpenses ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              adminExpenses: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Sinking funds
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.sinkingFunds ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sinkingFunds: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Building maintenance
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.buildingMaintenance ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              buildingMaintenance: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Parking / common area
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.parkingCharges ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              parkingCharges: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          Non-occupancy / misc
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={settings.nonOccupancyCharges ?? 0}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              nonOccupancyCharges: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Set unused charges to 0. Saving rules updates open unpaid
                      invoices automatically.
                    </p>
                  </div>
                  <Button
                    disabled={saving}
                    onClick={() =>
                      void saveSettings(
                        {
                          maintenanceAmount1Bhk: settings.maintenanceAmount1Bhk,
                          maintenanceAmount2Bhk: settings.maintenanceAmount2Bhk,
                          maintenanceAmount3Bhk: settings.maintenanceAmount3Bhk,
                          maintenanceAmount: settings.maintenanceAmount,
                          lateFeeAmount: settings.lateFeeAmount,
                          dueDay: settings.dueDay,
                          gstNote: settings.gstNote,
                          municipalDues: settings.municipalDues,
                          adminExpenses: settings.adminExpenses,
                          sinkingFunds: settings.sinkingFunds,
                          buildingMaintenance: settings.buildingMaintenance,
                          parkingCharges: settings.parkingCharges,
                          nonOccupancyCharges: settings.nonOccupancyCharges,
                        },
                        "Maintenance rules saved"
                      )
                    }
                  >
                    {saving ? "Saving…" : "Save Rules"}
                  </Button>
                </div>
              )}

              {active === "integrations" && (
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    Payment gateway, SMS, and email will connect when the backend
                    is live. Until then, collections use the mock Pay Now flow
                    on invoices.
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Razorpay / UPI — planned</li>
                    <li>SMS provider — planned</li>
                    <li>SMTP email — planned</li>
                    <li>
                      WhatsApp — simulated reminders only (see WhatsApp log tab)
                    </li>
                  </ul>
                </div>
              )}

              {active === "whatsapp" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Simulated WhatsApp from Invoices → Send Reminder. Nothing is
                    sent to a real phone.
                  </p>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {!waLogs.length && (
                      <p className="text-sm text-muted-foreground">
                        No messages yet. Send a reminder from Invoices.
                      </p>
                    )}
                    {waLogs.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-2xl border border-border/60 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {w.type} · {w.invoiceNo}
                          </p>
                          <Badge
                            variant={
                              w.status === "Delivered"
                                ? "success"
                                : w.status === "Failed"
                                  ? "danger"
                                  : w.status === "Sent"
                                    ? "info"
                                    : "warning"
                            }
                          >
                            {w.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {w.mobile}
                        </p>
                        <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary/50 p-2 text-[11px]">
                          {w.message}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === "audit" && (
                <div className="max-h-[480px] space-y-2 overflow-y-auto">
                  {!audit.length && (
                    <p className="text-sm text-muted-foreground">
                      No audit events yet. Actions across the app will appear
                      here.
                    </p>
                  )}
                  {audit.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-secondary/50 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{a.action}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.entityType}/{a.entityId} · {a.actor}
                      </p>
                      <p className="mt-1 text-xs">{a.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
