"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Car,
  Clock,
  Download,
  QrCode,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { visitorService, type SocietyVisitor } from "@/services/visitor.service";
import { apiErrorMessage, visitorsApi } from "@/lib/api-client";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VisitorsPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [visitors, setVisitors] = useState<SocietyVisitor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gateUrl, setGateUrl] = useState<string | null>(null);
  const [gateQrDataUrl, setGateQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!society) return;
    void visitorService.reload(society.id).then(() => {
      setVisitors(visitorService.list(society.id));
    });
  }, [society]);

  const loadGateQr = useCallback(async () => {
    if (!society) return;
    setQrBusy(true);
    setError(null);
    try {
      const data = await visitorsApi.ensureGateQr(society.id);
      // Deploy-ready: QR must encode the same exact URL the user will open.
      // Prefer the server-generated `gateUrl` (uses ADMIN_PUBLIC_URL), fallback to runtime origin.
      const url =
        data.gateUrl ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/gate/${data.token}`
          : null);
      if (!url) throw new Error("Gate URL unavailable");
      setGateUrl(url);
      setGateQrDataUrl(await QRCode.toDataURL(url, { width: 512, margin: 2 }));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setQrBusy(false);
    }
  }, [society]);

  useEffect(() => {
    if (society) {
      setVisitors(visitorService.list(society.id));
      void loadGateQr();
    }
  }, [society?.id, loadGateQr]);

  useLiveRefresh(refresh, !!society?.id, { scope: "visitors", immediate: false });

  if (!society) return null;

  function downloadSocietyQr() {
    if (!gateQrDataUrl) return;
    const a = document.createElement("a");
    a.href = gateQrDataUrl;
    a.download = `${society!.name.replace(/\s+/g, "-")}-gate-qr.png`;
    a.click();
  }

  function printSocietyQr() {
    if (!gateQrDataUrl || !gateUrl || !society) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${society.name} Gate QR</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:40px}
        img{width:360px;height:360px}
        h1{font-size:22px;margin:0 0 8px}
        p{color:#555;font-size:13px}
      </style></head><body>
      <h1>${society.name}</h1>
      <p>Visitor check-in — scan to register</p>
      <img src="${gateQrDataUrl}" alt="Gate QR" />
      <p>${gateUrl}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Visitors"
        description="Society gate QR opens a fast check-in form. Submissions land here with no approval step. Residents only see their own flat."
      />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> Society gate QR
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated once per society. Print and place at the gate — any scan opens check-in.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={qrBusy} onClick={() => void loadGateQr()}>
            Refresh QR
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {gateQrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gateQrDataUrl}
              alt="Society gate QR"
              className="h-48 w-48 rounded-2xl border bg-white p-2"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
              {qrBusy ? "Generating…" : "No QR yet"}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            {gateUrl && (
              <a
                href={gateUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-sm font-medium text-primary hover:underline"
              >
                {gateUrl} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={downloadSocietyQr} disabled={!gateQrDataUrl}>
                <Download className="mr-1.5 h-4 w-4" /> Download PNG
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={printSocietyQr}
                disabled={!gateQrDataUrl}
              >
                Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visitor log ({visitors.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitors.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4"
            >
              {v.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.photoUrl}
                  alt={v.name}
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{v.name}</p>
                  <Badge variant="secondary">{v.status}</Badge>
                  {v.passNumber && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {v.passNumber}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Flat {v.flat}
                  {v.visitType ? ` · ${v.visitType}` : ""}
                  {v.companyName ? ` · ${v.companyName}` : v.purpose ? ` · ${v.purpose}` : ""}
                  {v.phone ? ` · ${v.phone}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />{" "}
                    {v.vehicleType || v.vehicle}
                    {v.vehicleNo ? ` ${v.vehicleNo}` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />{" "}
                    {v.checkInAt
                      ? new Date(v.checkInAt).toLocaleString("en-IN")
                      : v.expectedTime || new Date(v.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Remove ${v.name}?`)) {
                      setError(null);
                      void visitorService.remove(v.id, actor).then(
                        () => refresh(),
                        (e) => {
                          setError(e instanceof Error ? e.message : "Could not delete visitor");
                          refresh();
                        }
                      );
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!visitors.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No visitor entries yet. Scan the society gate QR to register the first visitor.
            </p>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
