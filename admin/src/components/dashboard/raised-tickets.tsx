"use client";

import Link from "next/link";

/** Complaints tickets come from the API when that module is wired — no demo rows. */
export function RaisedTickets() {
  return (
    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
          Raised Tickets
        </h3>
        <Link
          href="/complaints"
          className="text-xs font-semibold text-[#4F46E5] hover:underline"
        >
          View all
        </Link>
      </div>
      <p className="py-8 text-center text-sm text-slate-400">
        No tickets yet.
      </p>
    </div>
  );
}
