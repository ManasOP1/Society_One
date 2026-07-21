"use client";

import { useEffect, useState } from "react";
import { Calendar, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  eventService,
  type EventStatus,
  type SocietyEvent,
} from "@/services/event.service";
import { formatCurrency } from "@/lib/utils";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type FormState = {
  title: string;
  date: string;
  endDate: string;
  location: string;
  description: string;
  budget: string;
  status: EventStatus;
};

const empty: FormState = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  location: "",
  description: "",
  budget: "0",
  status: "Upcoming",
};

export default function EventsPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [events, setEvents] = useState<SocietyEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SocietyEvent | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!society) return;
    void eventService.list(society.id).then(setEvents).catch((e) => setError(e.message));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [society?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (ev: SocietyEvent) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      date: ev.date,
      endDate: ev.endDate,
      location: ev.location,
      description: ev.description,
      budget: String(ev.budget),
      status: ev.status,
    });
    setError(null);
    setShowForm(true);
  };

  const onSave = async () => {
    if (!society) return;
    if (!form.title.trim() || !form.location.trim()) {
      setError("Title and location are required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      date: form.date,
      endDate: form.endDate || form.date,
      location: form.location.trim(),
      description: form.description.trim(),
      budget: Number(form.budget) || 0,
      status: form.status,
    };
    try {
      if (editing) {
        await eventService.update(editing.id, payload, actor);
      } else {
        await eventService.create(society.id, payload, actor);
      }
      setShowForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save event");
    }
  };

  if (!society) return null;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Events"
        description="Society calendar — meetings, festivals, and community activities"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add event
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{event.title}</CardTitle>
                <Badge
                  variant={
                    event.status === "Upcoming"
                      ? "default"
                      : event.status === "Ongoing"
                        ? "info"
                        : "secondary"
                  }
                  className="mt-2"
                >
                  {event.status}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(event)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Delete “${event.title}”?`)) {
                      void eventService
                        .remove(event.id, actor)
                        .then(refresh)
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : "Could not delete event")
                        );
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                {event.date}
                {event.endDate !== event.date ? ` – ${event.endDate}` : ""}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {event.location}
              </div>
              {event.description && (
                <p className="text-muted-foreground">{event.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Budget {formatCurrency(event.budget)} · {event.rsvpCount} RSVPs
                recorded
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!events.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No events yet. Add your first society event.
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{editing ? "Edit event" : "Add event"}</CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
              <Input
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Budget"
                  value={form.budget}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, budget: e.target.value }))
                  }
                />
                <select
                  className="h-10 rounded-2xl border border-input bg-card px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as EventStatus,
                    }))
                  }
                >
                  <option value="Upcoming">Upcoming</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={onSave}>
                {editing ? "Update event" : "Save event"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
