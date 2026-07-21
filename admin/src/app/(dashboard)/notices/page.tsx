"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pin, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { noticeService, type SocietyNotice } from "@/services/notice.service";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function NoticesPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [notices, setNotices] = useState<SocietyNotice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!society) return;
    void noticeService.list(society.id).then(setNotices).catch((e) => setError(e.message));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [society?.id]);

  const onPublish = async () => {
    if (!society) return;
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }
    try {
      await noticeService.create(society.id, { title, body, pinned }, actor);
      setTitle("");
      setBody("");
      setPinned(false);
      setShowForm(false);
      setError(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish notice");
    }
  };

  if (!society) return null;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Notices"
        description="Announcements for residents — water cuts, dues, meetings"
        actions={
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            <Megaphone className="h-4 w-4" /> Publish notice
          </Button>
        }
      />

      <div className="space-y-3">
        {notices.map((notice) => {
          const open = expanded === notice.id;
          return (
            <Card key={notice.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{notice.title}</CardTitle>
                    {notice.pinned && (
                      <Badge variant="info">
                        <Pin className="mr-1 h-3 w-3" /> Pinned
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Published {notice.publishedAt}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={notice.pinned ? "Unpin" : "Pin"}
                    onClick={() => {
                      void noticeService.togglePin(notice.id, actor, notice.pinned).then(refresh);
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Delete this notice?")) {
                        void noticeService
                          .remove(notice.id, actor)
                          .then(refresh)
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : "Could not delete notice")
                          );
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-sm text-muted-foreground leading-relaxed ${
                    open ? "" : "line-clamp-2"
                  }`}
                >
                  {notice.body}
                </p>
                {notice.body.length > 120 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0 text-primary"
                    onClick={() => setExpanded(open ? null : notice.id)}
                  >
                    {open ? "Show less" : "Read more"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!notices.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No notices yet. Publish one for your residents.
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Publish notice</CardTitle>
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-input bg-card px-3 py-2 text-sm"
                placeholder="Message for residents…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                Pin to top
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={onPublish}>
                <Plus className="h-4 w-4" /> Publish
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
