"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiErrorMessage, gateApi } from "@/lib/api-client";
import {
  COMPANY_GROUPS,
  VEHICLE_TYPES,
  VISIT_TYPES,
} from "@/lib/gate-options";

type Wing = { id?: string; code: string; label: string };
type FlatOpt = { id: string; flatNo: string; label: string };
type PassResult = {
  id: string;
  passNumber: string | null;
  name: string;
  flat: string;
  phone: string | null;
  photoUrl: string | null;
  visitType: string | null;
  companyName: string | null;
  vehicleType: string | null;
  vehicleNo: string | null;
  checkInAt: string | null;
  societyName: string;
  message: string;
};

const STEPS = [
  "Photo",
  "Details",
  "Visit type",
  "Company",
  "Wing",
  "Flat",
  "Vehicle",
  "Number",
  "Submit",
] as const;

function deviceId() {
  if (typeof window === "undefined") return "";
  const key = "so_gate_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function GateCheckInPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [societyName, setSocietyName] = useState("");
  const [address, setAddress] = useState("");
  const [wings, setWings] = useState<Wing[]>([]);

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [visitType, setVisitType] = useState("");
  const [company, setCompany] = useState("");
  const [companyOther, setCompanyOther] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [wingCode, setWingCode] = useState("");
  const [flats, setFlats] = useState<FlatOpt[]>([]);
  const [flatNo, setFlatNo] = useState("");
  const [flatQuery, setFlatQuery] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PassResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void gateApi
      .context(token)
      .then((ctx) => {
        if (cancelled) return;
        setSocietyName(ctx.societyName);
        setAddress(ctx.address);
        const list =
          ctx.wings?.length > 0
            ? ctx.wings.map((w) => ({
                id: w.id,
                code: w.code,
                label: w.label || `${w.code} Wing`,
              }))
            : [];
        setWings(list);
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError("Camera permission denied. Allow camera access to continue.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (step === 0 && !photo) void startCamera();
    if (step !== 0) stopCamera();
    return () => stopCamera();
  }, [step, photo, startCamera, stopCamera]);

  useEffect(() => {
    if (!wingCode) {
      setFlats([]);
      setFlatNo("");
      return;
    }
    void gateApi
      .flats(token, wingCode)
      .then(setFlats)
      .catch(() => setFlats([]));
  }, [token, wingCode]);

  const companyName = company === "Other" ? companyOther.trim() : company;

  const phoneOk = /^\d{10}$/.test(phone);
  const stepValid = [
    !!photo && !!capturedAt,
    name.trim().length > 1 && phoneOk,
    !!visitType,
    companyName.length > 0,
    !!wingCode,
    !!flatNo,
    !!vehicleType,
    vehicleNo.trim().length >= 4,
    true,
  ][step];

  const canSubmit =
    !!photo &&
    !!capturedAt &&
    name.trim().length > 1 &&
    phoneOk &&
    !!visitType &&
    companyName.length > 0 &&
    !!wingCode &&
    !!flatNo &&
    !!vehicleType &&
    vehicleNo.trim().length >= 4;

  /**
   * Methods: #20 — pre-filter via query; #23 — options are small so client filter is safe.
   * Map visit type -> relevant company group to keep guard interaction under 20s.
   */
  const targetCompanyGroup = useMemo(() => {
    const vt = visitType.trim();
    if (vt === "Food Delivery") return "Food Delivery";
    if (vt === "Grocery Delivery") return "Instant Delivery";
    if (vt === "Shopping Delivery") return "Shopping";
    if (vt === "Courier") return "Courier";
    if (vt === "Uber" || vt === "Ola" || vt === "Rapido") return "Ride Services";
    return "Other";
  }, [visitType]);

  const targetCompanies = useMemo(() => {
    const list =
      COMPANY_GROUPS.find((g) => g.group === targetCompanyGroup)?.companies ??
      ["Other"];
    // We render the "Other" button separately in the UI to avoid duplicates.
    return list.filter((c) => c !== "Other");
  }, [targetCompanyGroup]);

  // When guard changes visit type, reset company selection for correctness.
  useEffect(() => {
    setCompany("");
    setCompanyOther("");
    setCompanyQuery("");
  }, [visitType]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return targetCompanies.filter((c) => !q || c.toLowerCase().includes(q));
  }, [companyQuery, targetCompanies]);

  const filteredFlats = useMemo(() => {
    const q = flatQuery.trim().toLowerCase();
    return flats.filter(
      (f) =>
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.flatNo.toLowerCase().includes(q)
    );
  }, [flats, flatQuery]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    canvas.width = Math.min(w, 960);
    canvas.height = Math.round((h / w) * canvas.width);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    setPhoto(dataUrl);
    setCapturedAt(new Date());
    stopCamera();
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await gateApi.checkIn(token, {
        name: name.trim(),
        phone,
        visitType,
        companyName,
        wingCode,
        flatNo,
        vehicleType,
        vehicleNo: vehicleNo.trim().toUpperCase(),
        photoBase64: photo,
        createdByName: "Gate Guard",
        deviceId: deviceId(),
      });
      setResult(created);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Opening gate check-in…</p>
      </main>
    );
  }

  if (error && !societyName) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Invalid gate QR</p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="mx-auto max-w-sm text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
          <h2 className="mt-4 text-xl font-bold">Visitor Registered Successfully</h2>
          <p className="mt-2 text-sm text-slate-400">
            {result.name} → {result.flat}
          </p>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setPhoto(null);
              setCapturedAt(null);
              setName("");
              setPhone("");
              setVisitType("");
              setCompany("");
              setCompanyOther("");
              setWingCode("");
              setFlatNo("");
              setVehicleType("");
              setVehicleNo("");
              setStep(0);
            }}
            className="mt-8 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Register next visitor
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-lg">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Gate check-in
          </p>
          <h1 className="mt-1 text-2xl font-bold">{societyName}</h1>
          <p className="text-sm text-slate-400">{address}</p>
          <p className="mt-3 text-xs text-slate-500">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Capture visitor photo *</p>
              {!photo ? (
                <div className="overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt="Visitor preview"
                    className="aspect-[3/4] w-full rounded-2xl object-cover"
                  />
                  {capturedAt && (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      {capturedAt.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {!photo ? (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!cameraOn}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold disabled:opacity-40"
                    >
                      <Camera className="h-4 w-4" /> Capture
                    </button>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="rounded-2xl border border-white/20 px-4 py-3"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setCapturedAt(null);
                      void startCamera();
                    }}
                    className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold"
                  >
                    Retake photo
                  </button>
                )}
              </div>
              <label className="block text-center text-xs text-slate-400">
                Or upload
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-2 block w-full text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setPhoto(String(reader.result));
                      setCapturedAt(new Date());
                      stopCamera();
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm">
                Visitor Name *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Full name"
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                Mobile Number *
                <input
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  inputMode="numeric"
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="10 digits"
                />
                {!phoneOk && phone.length > 0 && (
                  <span className="mt-1 block text-xs text-amber-300">
                    Enter exactly 10 digits
                  </span>
                )}
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {VISIT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setVisitType(t)}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm ${
                    visitType === t
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-950/70 text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Search company"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <div className="max-h-[45vh] space-y-3 overflow-y-auto">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {targetCompanyGroup}
                </p>
                <div className="flex flex-wrap gap-2">
                  {filteredCompanies.length ? (
                    filteredCompanies.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCompany(c)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          company === c
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-950 text-slate-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-400">
                      No companies found. Try a different search.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setCompany("Other")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      company === "Other"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-950 text-slate-300"
                    }`}
                  >
                    Other
                  </button>
                </div>
              </div>
              {company === "Other" && (
                <input
                  value={companyOther}
                  onChange={(e) => setCompanyOther(e.target.value)}
                  placeholder="Company Name *"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-2">
              {!wings.length && (
                <p className="col-span-2 rounded-2xl bg-slate-950 px-4 py-6 text-center text-sm text-slate-400">
                  No wings configured for this society. Ask the admin to set up
                  wings in settings.
                </p>
              )}
              {wings.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => {
                    setWingCode(w.code);
                    setFlatNo("");
                  }}
                  className={`rounded-2xl px-4 py-4 text-sm font-semibold ${
                    wingCode === w.code
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-950 text-slate-200"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={flatQuery}
                  onChange={(e) => setFlatQuery(e.target.value)}
                  placeholder={`Search ${wingCode}-…`}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                {filteredFlats.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFlatNo(f.flatNo)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm ${
                      flatNo === f.flatNo
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-950 text-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                {!filteredFlats.length && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    No flats for this wing. Check society flat master.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicleType(v)}
                  className={`rounded-2xl px-4 py-4 text-sm font-semibold ${
                    vehicleType === v
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-950 text-slate-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {step === 7 && (
            <label className="block text-sm">
              Vehicle Number *
              <input
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono uppercase outline-none focus:border-emerald-400"
                placeholder="MH02AB1234"
                autoFocus
              />
            </label>
          )}

          {step === 8 && (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Review & submit</p>
              <ul className="space-y-1 rounded-2xl bg-slate-950/70 p-4 text-slate-300">
                <li>{name} · {phone}</li>
                <li>
                  {visitType} · {companyName}
                </li>
                <li>
                  {wingCode}-{flatNo}
                </li>
                <li>
                  {vehicleType} · {vehicleNo}
                </li>
                <li className="text-xs text-slate-500">
                  Check-in {capturedAt?.toLocaleString("en-IN")}
                </li>
              </ul>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={() => void submit()}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          )}
        </section>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-2xl border border-white/15 px-4 py-3 text-sm disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              disabled={!stepValid}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
