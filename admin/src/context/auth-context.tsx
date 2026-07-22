"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Society, Member, PaymentRecord } from "@/data/societies";
import {
  authApi,
  membersApi,
  getStoredUser,
  hasAccessToken,
  setApiSession,
  clearApiSession,
  apiErrorMessage,
  notifyDataUpdated,
  type ApiUser,
} from "@/lib/api-client";
import { LIVE_SYNC_DEBOUNCE_MS } from "@/constants/live-sync";
import { subscribeLiveData } from "@/lib/live-data-events";
import { societyService, SUPER_ADMIN } from "@/services/society.service";
import { settingsService } from "@/services/settings.service";
import { cacheKey, readAdminCache, writeAdminCache, clearAdminCachePrefix, clearSocietyAdminCache } from "@/lib/admin-cache";

type AuthRole = "society" | "super_admin";

interface AuthContextValue {
  role: AuthRole | null;
  society: Society | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  /** False until persisted session + society bootstrap finishes (prevents login flash on reload). */
  sessionReady: boolean;
  societies: Society[];
  members: Member[];
  payments: PaymentRecord[];
  superAdminName: string;
  /** Society admin / resident login against the live Nest API. societyId is accepted for signature compatibility but ignored — the API resolves it from the account. */
  login: (societyId: string, email: string, password: string) => Promise<string | null>;
  /** Platform Super Admin login against the live Nest API. */
  loginSuperAdmin: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  refreshSocieties: () => void;
  /** Reload the current society row after settings save (name, address, etc.). */
  refreshSociety: () => Promise<void>;
  addMember: (
    member: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">
  ) => Promise<string | null>;
  updateMember: (
    id: string,
    member: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">
  ) => Promise<string | null>;
  deleteMember: (id: string) => Promise<string | null>;
  importMembers: (rows: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">[]) => number;
  setMembers: (members: Member[]) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "MB"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiMember(m: any, societyId: string): Member {
  const owner = m?.ownerName ?? "";
  return {
    id: m?.id ?? "",
    societyId,
    photo: initials(owner),
    flat: m?.flatNo ?? "",
    wing: m?.wing ?? "",
    owner,
    phone: m?.phone ?? "",
    email: m?.email ?? m?.loginEmail ?? "",
    parking: m?.parking ?? "",
    bhkType: m?.bhkType ?? undefined,
    maintenanceAmount:
      m?.maintenanceAmount != null ? Number(m.maintenanceAmount) : undefined,
    maintenance: "Pending",
    hasAppLogin: Boolean(m?.hasAppLogin ?? m?.user),
  };
}

function toApiMemberInput(input: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">) {
  const body: Record<string, unknown> = {
    ownerName: input.owner,
    phone: input.phone || undefined,
    email: input.email,
    parking: input.parking || undefined,
    wing: input.wing,
    flatNo: input.flat,
  };
  if (input.bhkType) body.bhkType = input.bhkType;
  if (input.maintenanceAmount != null && input.maintenanceAmount >= 0) {
    body.maintenanceAmount = input.maintenanceAmount;
  }
  if (input.password) body.password = input.password;
  return body;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(() => {
    if (typeof window === "undefined" || !hasAccessToken()) return null;
    return getStoredUser();
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!hasAccessToken()) return true;
    return !!getStoredUser();
  });
  const [members, setMembersState] = useState<Member[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = getStoredUser();
    if (!stored?.societyId) return [];
    return readAdminCache<Member[]>(cacheKey("members", stored.societyId)) ?? [];
  });
  const [payments] = useState<PaymentRecord[]>([]);
  const [societies, setSocieties] = useState<Society[]>(() => {
    if (typeof window === "undefined") return [];
    return readAdminCache<Society[]>(cacheKey("societies")) ?? [];
  });
  const [society, setSociety] = useState<Society | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredUser();
    if (!stored?.societyId) return null;
    return readAdminCache<Society>(cacheKey("society", stored.societyId));
  });
  const membersLoadedFor = useRef<string | null>(null);
  const membersLoadingFor = useRef<string | null>(null);

  const role: AuthRole | null =
    user?.role === "SUPER_ADMIN" ? "super_admin" : user ? "society" : null;
  const isSuperAdmin = role === "super_admin";
  const isAuthenticated = !!user;

  const loadMembers = useCallback(async (societyId: string) => {
    if (membersLoadingFor.current === societyId) return;
    membersLoadingFor.current = societyId;
    try {
      const rows = await membersApi.list(societyId);
      const mapped = rows.map((m) => mapApiMember(m, societyId));
      setMembersState(mapped);
      writeAdminCache(cacheKey("members", societyId), mapped);
    } catch (e) {
      const message = apiErrorMessage(e);
      if (!message.includes("Too Many Requests")) {
        console.warn("Failed to load members from API:", message);
      }
      // Keep the last good member list — do not wipe the UI on transient errors.
    } finally {
      membersLoadingFor.current = null;
    }
  }, []);

  const loadSociety = useCallback(async (u: ApiUser) => {
    if (!u.societyId) {
      setSociety(null);
      return;
    }
    const s = await societyService.me();
    const next = s
      ? { ...s, id: u.societyId, adminName: u.name, adminEmail: u.email }
      : null;
    setSociety(next);
    if (next) writeAdminCache(cacheKey("society", u.societyId!), next);
  }, []);

  const loadSocietyData = useCallback(
    async (u: ApiUser) => {
      if (!u.societyId) {
        setSociety(null);
        return;
      }
      membersLoadedFor.current = u.societyId;
      // Society + settings first (dashboard); members load in background.
      void loadMembers(u.societyId);
      await Promise.all([
        loadSociety(u),
        settingsService.fetch(u.societyId, { silent: true }).catch(() => undefined),
      ]);
    },
    [loadSociety, loadMembers]
  );

  const refreshSocieties = useCallback(() => {
    void (async () => {
      try {
        const list = await societyService.list();
        setSocieties(list);
        writeAdminCache(cacheKey("societies"), list);
      } catch (e) {
        console.error("Failed to load societies from API:", apiErrorMessage(e));
      }
    })();
  }, []);

  // Bootstrap: validate token quickly, load society data in background.
  useEffect(() => {
    void (async () => {
      if (!hasAccessToken()) {
        setIsLoading(false);
        setSessionReady(true);
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me as ApiUser);
        setIsLoading(false);
        setSessionReady(true);
        if (me.role === "SUPER_ADMIN") {
          void societyService
            .list()
            .then((list) => {
              setSocieties(list);
              writeAdminCache(cacheKey("societies"), list);
            })
            .catch(() => undefined);
        } else if (me.societyId) {
          membersLoadedFor.current = me.societyId;
          void loadSocietyData(me as ApiUser);
        }
      } catch {
        clearApiSession();
        setUser(null);
        setSociety(null);
        setMembersState([]);
        setIsLoading(false);
        setSessionReady(true);
      }
    })();
  }, [loadSocietyData]);

  // After interactive login, load society data without duplicate super-admin fetch.
  useEffect(() => {
    if (!user || isLoading) return;
    if (user.role === "SUPER_ADMIN") {
      if (societies.length === 0) refreshSocieties();
      return;
    }
    if (user.societyId && membersLoadedFor.current !== user.societyId) {
      void loadSocietyData(user);
    }
  }, [user, isLoading, loadSocietyData, refreshSocieties, societies.length]);

  // Refresh members on focus / cross-screen events only (no background polling).
  useEffect(() => {
    if (!user?.societyId || user.role === "SUPER_ADMIN") return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void loadMembers(user.societyId!);
    };

    const scheduleDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tick, LIVE_SYNC_DEBOUNCE_MS);
    };

    const unsub = subscribeLiveData("members", scheduleDebounced);
    window.addEventListener("focus", scheduleDebounced);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
      window.removeEventListener("focus", scheduleDebounced);
    };
  }, [user, loadMembers]);

  const login = useCallback(
    async (_societyId: string, email: string, password: string): Promise<string | null> => {
      try {
        const res = await authApi.login(email, password);
        if (res.user.role !== "SOCIETY_ADMIN" && res.user.role !== "COMMITTEE_MEMBER") {
          return "This account is not a society admin. Use the Super Admin login if applicable.";
        }
        setApiSession(
          { accessToken: res.accessToken, refreshToken: res.refreshToken },
          res.user
        );
        setUser(res.user);
        setSessionReady(true);
        if (res.user.societyId) {
          membersLoadedFor.current = res.user.societyId;
          void loadSocietyData(res.user);
        }
        return null;
      } catch (e) {
        return apiErrorMessage(e);
      }
    },
    [loadSocietyData]
  );

  const loginSuperAdmin = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const res = await authApi.login(email, password);
        if (res.user.role !== "SUPER_ADMIN") {
          return "Invalid Super Admin credentials.";
        }
        setApiSession(
          { accessToken: res.accessToken, refreshToken: res.refreshToken },
          res.user
        );
        setUser(res.user);
        setSessionReady(true);
        void societyService
          .list()
          .then((list) => {
            setSocieties(list);
            writeAdminCache(cacheKey("societies"), list);
          })
          .catch(() => undefined);
        return null;
      } catch (e) {
        return apiErrorMessage(e);
      }
    },
    []
  );

  const refreshSociety = useCallback(async () => {
    if (!user?.societyId) return;
    await loadSociety(user);
  }, [user, loadSociety]);

  const logout = useCallback(() => {
    void authApi.logout();
    const societyId = society?.id ?? user?.societyId ?? undefined;
    clearApiSession();
    setUser(null);
    setSociety(null);
    setSocieties([]);
    setMembersState([]);
    membersLoadedFor.current = null;
    clearAdminCachePrefix(cacheKey("societies"));
    if (societyId) clearSocietyAdminCache(societyId);
  }, [society?.id, user?.societyId]);

  const societyMembers = useMemo(
    () => (society ? members.filter((m) => m.societyId === society.id) : []),
    [members, society]
  );

  const societyPayments = useMemo(
    () => (society ? payments.filter((p) => p.societyId === society.id) : []),
    [payments, society]
  );

  const addMember = useCallback(
    async (
      member: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">
    ): Promise<string | null> => {
      if (!society) return "No society selected";
      try {
        const created = await membersApi.create(
          toApiMemberInput(member),
          society.id
        );
        setMembersState((prev) => {
          const next = [
            ...prev.filter((m) => m.email !== member.email),
            mapApiMember(created, society.id),
          ];
          writeAdminCache(cacheKey("members", society.id), next);
          return next;
        });
        return null;
      } catch (e) {
        return apiErrorMessage(e);
      }
    },
    [society]
  );

  const updateMember = useCallback(
    async (
      id: string,
      member: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">
    ): Promise<string | null> => {
      if (!society) return "No society selected";
      try {
        const updated = await membersApi.update(
          id,
          toApiMemberInput(member),
          society.id
        );
        setMembersState((prev) => {
          const next = prev.map((m) =>
            m.id === id ? mapApiMember(updated, society.id) : m
          );
          writeAdminCache(cacheKey("members", society.id), next);
          return next;
        });
        return null;
      } catch (e) {
        return apiErrorMessage(e);
      }
    },
    [society]
  );

  const deleteMember = useCallback(
    async (id: string): Promise<string | null> => {
      if (!society) return "No society selected";
      try {
        await membersApi.remove(id, society.id);
        setMembersState((prev) => {
          const next = prev.filter((m) => m.id !== id);
          writeAdminCache(cacheKey("members", society.id), next);
          return next;
        });
        notifyDataUpdated("members");
        return null;
      } catch (e) {
        return apiErrorMessage(e);
      }
    },
    [society]
  );

  const importMembers = useCallback(
    (rows: Omit<Member, "id" | "societyId" | "photo" | "hasAppLogin">[]) => {
      if (!society) return 0;
      const optimistic: Member[] = rows.map((row, i) => ({
        ...row,
        id: `pending-import-${Date.now()}-${i}`,
        societyId: society.id,
        photo: initials(row.owner),
      }));
      setMembersState((prev) => [...prev, ...optimistic]);
      void Promise.all(
        rows.map((row) => membersApi.create(toApiMemberInput(row), society.id))
      )
        .then(() => {
          notifyDataUpdated("members");
          return loadMembers(society.id);
        })
        .catch((e) => {
          console.error("Failed to import members:", apiErrorMessage(e));
          void loadMembers(society.id);
        });
      return optimistic.length;
    },
    [society, loadMembers]
  );

  const setMembers = useCallback((next: Member[]) => {
    setMembersState(next);
    const societyId = next[0]?.societyId;
    if (societyId) writeAdminCache(cacheKey("members", societyId), next);
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      role,
      society,
      isAuthenticated,
      isSuperAdmin,
      isLoading,
      sessionReady,
      societies,
      members: societyMembers,
      payments: societyPayments,
      superAdminName: user?.role === "SUPER_ADMIN" ? user.name : SUPER_ADMIN.name,
      login,
      loginSuperAdmin,
      logout,
      refreshSocieties,
      refreshSociety,
      addMember,
      updateMember,
      deleteMember,
      importMembers,
      setMembers,
    }),
    [
      role,
      society,
      isAuthenticated,
      isSuperAdmin,
      isLoading,
      sessionReady,
      societies,
      societyMembers,
      societyPayments,
      user,
      login,
      loginSuperAdmin,
      logout,
      refreshSocieties,
      refreshSociety,
      addMember,
      updateMember,
      deleteMember,
      importMembers,
      setMembers,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider. Ensure Providers wraps the app in app/layout.tsx."
    );
  }
  return ctx;
}
