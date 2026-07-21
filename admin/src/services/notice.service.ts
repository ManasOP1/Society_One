import { communityApi, apiErrorMessage, notifyDataUpdated } from "@/lib/api-client";
import { auditService } from "@/services/audit.service";

export interface SocietyNotice {
  id: string;
  societyId: string;
  title: string;
  body: string;
  publishedAt: string;
  pinned: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotice(raw: any): SocietyNotice {
  const published =
    raw?.publishedAt ?? raw?.createdAt ?? new Date().toISOString();
  return {
    id: String(raw?.id ?? ""),
    societyId: String(raw?.societyId ?? ""),
    title: String(raw?.title ?? ""),
    body: String(raw?.body ?? ""),
    publishedAt: String(published).slice(0, 10),
    pinned: Boolean(raw?.pinned),
    createdAt: String(raw?.createdAt ?? published),
  };
}

export const noticeService = {
  async list(_societyId: string): Promise<SocietyNotice[]> {
    try {
      const rows = await communityApi.notices();
      return rows.map(mapNotice).sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.publishedAt.localeCompare(a.publishedAt);
      });
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async create(
    _societyId: string,
    input: { title: string; body: string; pinned?: boolean },
    actor: string
  ): Promise<SocietyNotice> {
    try {
      const raw = await communityApi.createNotice({
        title: input.title.trim(),
        body: input.body.trim(),
        pinned: !!input.pinned,
      });
      const notice = mapNotice(raw);
      auditService.log({
        societyId: notice.societyId,
        action: "Notice Published",
        entityType: "notice",
        entityId: notice.id,
        details: notice.title,
        actor,
      });
      notifyDataUpdated();
      return notice;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async remove(id: string, actor: string): Promise<boolean> {
    try {
      await communityApi.deleteNotice(id);
      auditService.log({
        societyId: "",
        action: "Notice Deleted",
        entityType: "notice",
        entityId: id,
        details: id,
        actor,
      });
      notifyDataUpdated();
      return true;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async togglePin(id: string, actor: string, pinned: boolean): Promise<SocietyNotice> {
    try {
      const raw = await communityApi.updateNotice(id, { pinned: !pinned });
      const notice = mapNotice(raw);
      auditService.log({
        societyId: notice.societyId,
        action: notice.pinned ? "Notice Pinned" : "Notice Unpinned",
        entityType: "notice",
        entityId: id,
        details: notice.title,
        actor,
      });
      notifyDataUpdated();
      return notice;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },
};
