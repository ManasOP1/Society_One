# ER Diagram — SocietyOne Enterprise

## Domain map

```mermaid
flowchart TB
  subgraph Platform
    T[tenants]
    SA[SUPER_ADMIN users]
  end

  subgraph TenantScope
    S[societies]
    U[users]
    RA[user_role_assignments]
    W[wings]
    F[flats]
    M[members]
    SET[society_settings]
    CAT[charge_catalog]
    SEQ[number_sequences]
  end

  subgraph Billing
    INV[invoices]
    IL[invoice_lines]
    PAY[payments]
    PTX[payment_transactions]
    WH[payment_webhooks]
    REC[receipts]
  end

  subgraph Ops
    N[notices]
    E[society_events]
    V[visitors]
    C[complaints]
    D[documents]
    X[expenses]
  end

  subgraph Observability
    A[audit_logs]
    ACT[activity_logs]
    NOTIF[notifications]
  end

  T --> S
  S --> U
  U --> RA
  S --> W --> F --> M
  S --> SET
  S --> CAT
  S --> SEQ
  M --> INV --> IL
  INV --> PAY --> PTX
  WH --> PAY
  PAY --> REC
  S --> N & E & V & C & D & X
  S --> A & ACT & NOTIF
```

## Core financial ER

```mermaid
erDiagram
  TENANTS ||--o{ SOCIETIES : owns
  SOCIETIES ||--|| SOCIETY_SETTINGS : has
  SOCIETIES ||--o{ WINGS : has
  WINGS ||--o{ FLATS : contains
  SOCIETIES ||--o{ MEMBERS : has
  FLATS ||--o{ MEMBER_FLATS : occupancy
  MEMBERS ||--o{ MEMBER_FLATS : occupancy
  MEMBERS ||--o{ INVOICES : billed
  INVOICES ||--o{ INVOICE_LINES : lines
  INVOICES ||--o{ PAYMENTS : settles
  PAYMENTS ||--o{ PAYMENT_TRANSACTIONS : ledger
  PAYMENTS ||--o| RECEIPTS : issues
  PAYMENT_WEBHOOKS }o--|| PAYMENTS : correlates

  TENANTS {
    uuid id PK
    text slug UK
    text name
    timestamptz deleted_at
  }

  SOCIETIES {
    uuid id PK
    uuid tenant_id FK
    text slug
    text name
    text status_code
  }

  INVOICES {
    uuid id PK
    uuid tenant_id
    uuid society_id
    uuid member_id
    text invoice_no
    text billing_month
    numeric total_amount
    numeric paid_amount
    numeric outstanding
  }

  PAYMENTS {
    uuid id PK
    uuid tenant_id
    uuid society_id
    uuid invoice_id
    numeric amount
    text status_code
    text razorpay_order_id
  }

  PAYMENT_TRANSACTIONS {
    uuid id PK
    uuid payment_id
    text event_type
    numeric amount
    timestamptz created_at
  }

  RECEIPTS {
    uuid id PK
    uuid payment_id UK
    text receipt_no
    numeric total_paid
  }
```

## Identity & RBAC ER

```mermaid
erDiagram
  USERS ||--o{ USER_ROLE_ASSIGNMENTS : has
  LK_ROLE ||--o{ USER_ROLE_ASSIGNMENTS : defines
  SOCIETIES ||--o{ USER_ROLE_ASSIGNMENTS : scopes
  USERS ||--o{ REFRESH_TOKENS : issues
  MEMBERS ||--o| USERS : login

  USERS {
    uuid id PK
    uuid tenant_id
    uuid society_id
    uuid member_id
    citext email UK
    text password_hash
  }

  USER_ROLE_ASSIGNMENTS {
    uuid id PK
    uuid user_id
    text role_code
    uuid society_id
  }
```

## Cardinality notes

| Relationship | Cardinality | Notes |
| --- | --- | --- |
| Tenant → Society | 1:N | Soft-delete society; never orphan finances |
| Member → Invoice | 1:N | Unique (society_id, member_id, billing_month) active |
| Invoice → Payment | 1:N | Partial payments allowed |
| Payment → Receipt | 1:0..1 | Only after CAPTURED |
| Payment → Transactions | 1:N | Append-only state machine trail |
| User → Roles | 1:N | Multi-role (committee + resident) |
