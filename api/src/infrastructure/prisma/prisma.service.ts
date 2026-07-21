import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly tenantIdCache = new Map<string, string>();

  constructor(config: ConfigService) {
    const rawConnectionString = config.getOrThrow<string>('DATABASE_URL');
    const poolMax = config.get<number>('DB_POOL_MAX') ?? 10;
    const idleTimeoutMillis = config.get<number>('DB_POOL_IDLE_MS') ?? 30_000;
    const connectionTimeoutMillis = config.get<number>('DB_POOL_CONN_TIMEOUT_MS') ?? 30_000;
    // Supabase's pooler presents a chain signed by a CA not in Node's default trust
    // store. `sslmode=require` in the URL forces strict verification in `pg`, which
    // conflicts with an explicit `ssl` override, so strip it and pass ssl explicitly
    // (connection stays encrypted; only chain verification is relaxed).
    const connectionString = rawConnectionString.replace(/([?&])sslmode=[^&]+&?/, '$1').replace(/[?&]$/, '');
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.logger.log(`pg pool max=${poolMax} idle=${idleTimeoutMillis}ms`);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  /** Resolve the owning tenantId for a society; required on every child-row insert. */
  async getSocietyTenantId(societyId: string): Promise<string> {
    const cached = this.tenantIdCache.get(societyId);
    if (cached) return cached;

    const society = await this.society.findUnique({
      where: { id: societyId },
      select: { tenantId: true },
    });
    if (!society) throw new NotFoundException('Society not found');
    this.tenantIdCache.set(societyId, society.tenantId);
    return society.tenantId;
  }

  /**
   * Sets tenant context for RLS (defense in depth).
   * Call inside interactive transactions when using a DB role subject to RLS.
   */
  async withTenantContext<T>(
    ctx: { societyId?: string | null; userId?: string | null; role?: string | null },
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_society_id', $1, true),
                set_config('app.current_user_id', $2, true),
                set_config('app.current_role', $3, true)`,
        ctx.societyId ?? '',
        ctx.userId ?? '',
        ctx.role ?? '',
      );
      return fn(tx as unknown as PrismaClient);
    });
  }
}
