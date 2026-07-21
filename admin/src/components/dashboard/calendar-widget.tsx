"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { eventService, type SocietyEvent } from "@/services/event.service";
import { useLiveSocietySettings } from "@/hooks/use-live-society-settings";

export function CalendarWidget() {
  const { society } = useAuth();
  const [current, setCurrent] = useState(() => new Date());
  const [selected, setSelected] = useState<number | null>(null);

  const liveSettings = useLiveSocietySettings(society?.id);
  const dueDay = liveSettings?.dueDay ?? 10;
  const [events, setEvents] = useState<SocietyEvent[]>([]);

  useEffect(() => {
    if (!society) {
      setEvents([]);
      return;
    }
    void eventService.list(society.id).then(setEvents);
  }, [society?.id]);

  const eventDays = useMemo(() => {
    if (!society) return new Set<number>();
    const y = current.getFullYear();
    const m = current.getMonth() + 1;
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const days = new Set<number>();
    events.forEach((e) => {
      if (e.date.startsWith(prefix)) {
        days.add(Number(e.date.split("-")[2]));
      }
    });
    return days;
  }, [society, current, events]);

  const { daysInMonth, startPad } = useMemo(() => {
    const start = startOfMonth(current);
    const end = endOfMonth(current);
    return {
      daysInMonth: eachDayOfInterval({ start, end }),
      startPad: getDay(start),
    };
  }, [current]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
          {format(current, "MMMM yyyy")}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => setCurrent(subMonths(current, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-medium text-[#4F46E5] hover:bg-indigo-50 dark:hover:bg-indigo-950"
            onClick={() => setCurrent(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => setCurrent(addMonths(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {daysInMonth.map((day) => {
          const d = day.getDate();
          const hasEvent = eventDays.has(d);
          const isDue = d === dueDay;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              className={cn(
                "relative flex h-8 items-center justify-center rounded-lg text-xs",
                isToday(day) && "font-bold text-[#4F46E5]",
                selected === d && "bg-indigo-50 dark:bg-indigo-950",
                !isToday(day) && "text-slate-700 dark:text-slate-200"
              )}
            >
              {d}
              {(hasEvent || isDue) && (
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {hasEvent && (
                    <span className="h-1 w-1 rounded-full bg-[#4F46E5]" />
                  )}
                  {isDue && (
                    <span className="h-1 w-1 rounded-full bg-orange-400" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />
        Event
        <span className="ml-3 mr-2 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
        Maintenance due (day {dueDay})
      </p>
    </div>
  );
}
