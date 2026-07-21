"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const tickets = [
  {
    id: 1,
    name: "Micheal Smith",
    issue: "Water Problem",
    flat: "B-302",
    priority: "High" as const,
    seed: "Micheal",
  },
  {
    id: 2,
    name: "Peter Johns",
    issue: "Event Proposal",
    flat: "A-101",
    priority: "Medium" as const,
    seed: "Peter",
  },
  {
    id: 3,
    name: "Anita Rao",
    issue: "Parking Issue",
    flat: "C-205",
    priority: "Low" as const,
    seed: "Anita",
  },
];

const priorityVariant = {
  High: "danger" as const,
  Medium: "warning" as const,
  Low: "info" as const,
};

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
          See All
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href="/complaints"
            className="flex items-center gap-3 py-3 transition-colors first:pt-1 last:pb-0 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 -mx-2 px-2 rounded-xl"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ticket.seed}&backgroundColor=c0aede`}
              />
              <AvatarFallback>
                {ticket.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {ticket.name}
                </p>
                <Badge variant={priorityVariant[ticket.priority]} className="shrink-0">
                  {ticket.priority}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {ticket.issue} · Flat {ticket.flat}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
