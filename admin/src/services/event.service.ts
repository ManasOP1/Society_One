import { communityApi, apiErrorMessage, notifyDataUpdated } from "@/lib/api-client";
import { auditService } from "@/services/audit.service";

export type EventStatus = "Upcoming" | "Ongoing" | "Completed";

export interface SocietyEvent {
  id: string;
  societyId: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  description: string;
  budget: number;
  rsvpCount: number;
  status: EventStatus;
  createdAt: string;
}

const STATUS_MAP: Record<string, EventStatus> = {
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Completed",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(raw: any): SocietyEvent {
  const statusCode = String(raw?.statusCode ?? raw?.status ?? "UPCOMING");
  const eventDate = raw?.eventDate ?? raw?.date;
  const endDate = raw?.endDate ?? eventDate;
  return {
    id: String(raw?.id ?? ""),
    societyId: String(raw?.societyId ?? ""),
    title: String(raw?.title ?? ""),
    date: eventDate ? String(eventDate).slice(0, 10) : "",
    endDate: endDate ? String(endDate).slice(0, 10) : "",
    location: String(raw?.location ?? ""),
    description: String(raw?.description ?? ""),
    budget: Number(raw?.budget) || 0,
    rsvpCount: Number(raw?.rsvpCount) || 0,
    status: STATUS_MAP[statusCode] ?? "Upcoming",
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
  };
}

function toApiStatus(status?: EventStatus): string | undefined {
  if (!status) return undefined;
  if (status === "Upcoming") return "UPCOMING";
  if (status === "Ongoing") return "ONGOING";
  return "COMPLETED";
}

export const eventService = {
  async list(_societyId: string): Promise<SocietyEvent[]> {
    try {
      const rows = await communityApi.events();
      return rows.map(mapEvent).sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async upcoming(societyId: string, limit = 5): Promise<SocietyEvent[]> {
    const rows = await this.list(societyId);
    return rows.filter((e) => e.status !== "Completed").slice(0, limit);
  },

  async create(
    _societyId: string,
    input: Omit<SocietyEvent, "id" | "societyId" | "createdAt" | "rsvpCount">,
    actor: string
  ): Promise<SocietyEvent> {
    try {
      const raw = await communityApi.createEvent({
        title: input.title,
        date: input.date,
        endDate: input.endDate || undefined,
        location: input.location,
        description: input.description,
        budget: input.budget,
        status: toApiStatus(input.status),
      });
      const event = mapEvent(raw);
      auditService.log({
        societyId: event.societyId,
        action: "Event Created",
        entityType: "event",
        entityId: event.id,
        details: event.title,
        actor,
      });
      notifyDataUpdated("events");
      return event;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async update(
    id: string,
    patch: Partial<Omit<SocietyEvent, "id" | "societyId" | "createdAt">>,
    actor: string
  ): Promise<SocietyEvent> {
    try {
      const raw = await communityApi.updateEvent(id, {
        title: patch.title,
        date: patch.date,
        endDate: patch.endDate,
        location: patch.location,
        description: patch.description,
        budget: patch.budget,
        status: toApiStatus(patch.status),
      });
      const event = mapEvent(raw);
      auditService.log({
        societyId: event.societyId,
        action: "Event Updated",
        entityType: "event",
        entityId: id,
        details: event.title,
        actor,
      });
      notifyDataUpdated("events");
      return event;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async remove(id: string, actor: string): Promise<boolean> {
    try {
      await communityApi.deleteEvent(id);
      auditService.log({
        societyId: "",
        action: "Event Deleted",
        entityType: "event",
        entityId: id,
        details: id,
        actor,
      });
      notifyDataUpdated("events");
      return true;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },
};
