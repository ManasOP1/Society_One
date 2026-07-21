# Redis Caching Strategy

## Purpose

Absorb read amplification for dashboards, settings, and auth sessions under high concurrency. **Never cache authoritative money balances without short TTL + write invalidation.**

## Key design

```text
so:{env}:{tenantId}:{societyId}:{domain}:{id_or_hash}
```

| Key | TTL | Invalidate on |
| --- | --- | --- |
| `so:prod:{t}:{s}:settings` | 5m | settings PATCH |
| `so:prod:{t}:{s}:dashboard` | 30–60s | payment CAPTURED, invoice generate |
| `so:prod:{t}:{s}:member:{m}:summary` | 60s | payment, invoice change |
| `so:prod:user:{userId}:session` | align refresh TTL | logout / password change |
| `so:prod:ratelimit:login:{ip}` | 1m | sliding window |
| `so:prod:idempotency:{key}` | 24h | — (store response) |
| `so:prod:razorpay:order:{id}` | 15m | webhook |

## Patterns

1. **Cache-aside** for settings & dashboard (read Redis → miss → DB → set).
2. **Write-through invalidate** publish `society:{id}:invalidate` on BullMQ after settle.
3. **Idempotency store** for `POST /payments/orders` duplicate retries.
4. **Lock** `SET lock:settle:{paymentId} NX EX 30` around webhook processing.
5. **Do not** cache RLS-sensitive cross-user lists in shared keys without memberId.

## BullMQ / Redis coexistence

- Separate Redis DB index or key prefix: `bull:` vs `so:`.
- Memory: eviction `volatile-lru` for cache keys with TTL; never evict Bull queues.

## Realtime

- Supabase Realtime for visitors/notices; Redis pub/sub optional for Nest multi-instance cache bust.
