"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: (n: number) => string;
}

export function AnimatedCounter({
  value,
  duration = 0.35,
  prefix = "",
  suffix = "",
  className,
  format,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) {
      setDisplay(value);
      return;
    }
    const from = prev.current;
    prev.current = value;

    let frame: number;
    const startTime = performance.now();
    const delta = value - from;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const text = format
    ? format(display)
    : `${prefix}${display.toLocaleString("en-IN")}${suffix}`;

  return <span className={className}>{text}</span>;
}
