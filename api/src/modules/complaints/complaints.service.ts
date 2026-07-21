import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ComplaintPriority,
  ComplaintStatus,
  Role,
} from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type CreateComplaintInput = {
  title: string;
  description: string;
  category?: string;
  priority?: ComplaintPriority;
  /** Required when an admin creates on behalf of a member. */
  memberId?: string;
};

export type UpdateComplaintStatusInput = {
  status: ComplaintStatus;
  priority?: ComplaintPriority;
};

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(societyId: string, user: AuthUser, status?: ComplaintStatus) {
    const where: Prisma.ComplaintWhereInput = { societyId, deletedAt: null };
    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      where.memberId = user.memberId;
    }
    if (status) where.statusCode = status;

    return this.prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, ownerName: true } },
      },
    });
  }

  async create(societyId: string, input: CreateComplaintInput, actor: AuthUser) {
    const memberId =
      actor.role === Role.RESIDENT ? actor.memberId : input.memberId ?? actor.memberId;
    if (!memberId) {
      throw new ForbiddenException('memberId required to create complaint');
    }
    if (actor.role === Role.RESIDENT && memberId !== actor.memberId) {
      throw new ForbiddenException('Cannot create complaint for another member');
    }
    const tenantId = await this.prisma.getSocietyTenantId(societyId);

    const complaint = await this.prisma.complaint.create({
      data: {
        tenantId,
        societyId,
        memberId,
        title: input.title,
        description: input.description,
        category: input.category,
        priorityCode: input.priority ?? ComplaintPriority.MEDIUM,
        statusCode: ComplaintStatus.OPEN,
      },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'COMPLAINT_CREATED',
      entityType: 'Complaint',
      entityId: complaint.id,
      details: complaint.title,
    });

    return complaint;
  }

  async updateStatus(
    societyId: string,
    id: string,
    input: UpdateComplaintStatusInput,
    actor: AuthUser,
  ) {
    const existing = await this.prisma.complaint.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Complaint not found');

    const data: Prisma.ComplaintUpdateInput = {
      statusCode: input.status,
    };
    if (input.priority !== undefined) data.priorityCode = input.priority;
    if (
      input.status === ComplaintStatus.RESOLVED ||
      input.status === ComplaintStatus.REJECTED
    ) {
      data.resolvedAt = new Date();
    }

    const complaint = await this.prisma.complaint.update({
      where: { id },
      data,
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'COMPLAINT_STATUS_UPDATED',
      entityType: 'Complaint',
      entityId: complaint.id,
      details: `Status -> ${complaint.statusCode}`,
    });

    return complaint;
  }
}
