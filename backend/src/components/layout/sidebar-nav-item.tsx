"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ComponentType, Ref } from "react";
import { cn } from "@/lib/utils";

type IconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIconProps = {
  size?: number;
  color?: string;
  isAnimated?: boolean;
  className?: string;
  duration?: number;
};

type SidebarNavItemProps = {
  href: string;
  label: string;
  active: boolean;
  open: boolean;
  Icon: ComponentType<AnimatedIconProps & { ref?: Ref<IconHandle> }>;
  onNavigate?: () => void;
};

export function SidebarNavItem({
  href,
  label,
  active,
  open,
  Icon,
  onNavigate,
}: SidebarNavItemProps) {
  const iconRef = useRef<IconHandle>(null);

  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      onClick={onNavigate}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      onFocus={() => iconRef.current?.startAnimation()}
      onBlur={() => iconRef.current?.stopAnimation()}
      className={cn(
        "group relative flex items-center rounded-xl text-[13px] font-medium transition-colors",
        open ? "h-10 gap-3 px-3" : "h-10 w-10 justify-center",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:overflow-visible">
        <Icon
          ref={iconRef}
          size={18}
          color={active ? "#ffffff" : "#64748B"}
          isAnimated={false}
          duration={0.4}
        />
      </span>
      {open && <span className="truncate">{label}</span>}
    </Link>
  );
}
