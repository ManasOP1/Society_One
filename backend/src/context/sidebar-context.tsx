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

type SidebarContextValue = {
  expanded: boolean;
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onEnter: () => void;
  onLeave: () => void;
  railWidth: number;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SIDEBAR_COLLAPSED = 72;
export const SIDEBAR_EXPANDED = 256;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(true); // safe default for SSR/mobile
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setExpanded(false);
      }
      setReady(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    if (!ready || isMobile) return;
    clearLeaveTimer();
    setExpanded(true);
  }, [ready, isMobile, clearLeaveTimer]);

  const onLeave = useCallback(() => {
    if (!ready || isMobile) return;
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => setExpanded(false), 150);
  }, [ready, isMobile, clearLeaveTimer]);

  const railWidth = useMemo(() => {
    if (isMobile) return 0;
    return expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;
  }, [isMobile, expanded]);

  const value = useMemo(
    () => ({
      expanded: isMobile ? mobileOpen : expanded,
      isMobile,
      mobileOpen,
      setMobileOpen,
      onEnter,
      onLeave,
      railWidth,
    }),
    [expanded, isMobile, mobileOpen, onEnter, onLeave, railWidth]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
