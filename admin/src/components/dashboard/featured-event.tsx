"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { eventService, type SocietyEvent } from "@/services/event.service";

function formatRange(start: string, end: string) {
  if (start === end) return start;
  return `${start} – ${end}`;
}

export function FeaturedEvent() {
  const { society } = useAuth();
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [index, setIndex] = useState(0);
  const event = events[index] ?? null;

  useEffect(() => {
    if (!society) {
      setEvents([]);
      return;
    }
    void eventService.upcoming(society.id, 5).then(setEvents);
  }, [society?.id]);

  if (!event) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#4F46E5]">
          Upcoming
        </p>
        <p className="mt-3 text-sm text-slate-500">No upcoming events.</p>
        <Link
          href="/events"
          className="mt-3 inline-flex text-xs font-semibold text-[#4F46E5] hover:underline"
        >
          Add an event →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#4F46E5]">
          <Calendar className="h-3.5 w-3.5" />
          Upcoming
        </span>
        {events.length > 1 && (
          <div className="flex gap-1">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() =>
                setIndex((i) => (i === 0 ? events.length - 1 : i - 1))
              }
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() =>
                setIndex((i) => (i === events.length - 1 ? 0 : i + 1))
              }
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
        {event.title}
      </h3>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatRange(event.date, event.endDate)}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{event.location}</p>
      <Link
        href="/events"
        className="mt-3 inline-flex text-xs font-semibold text-[#4F46E5] hover:underline"
      >
        View all events →
      </Link>
    </div>
  );
}
