# Supabase Storage Hierarchy

Bucket: `societyone-docs` (private; signed URLs only).

```text
societyone-docs/
└── tenants/
    └── {tenant_id}/
        └── societies/
            └── {society_id}/
                ├── logos/
                │   └── logo.{ext}
                ├── invoices/
                │   └── {yyyy}/
                │       └── {mm}/
                │           └── {invoice_no}.pdf
                ├── receipts/
                │   └── {yyyy}/
                │       └── {mm}/
                │           └── {receipt_no}.pdf
                ├── expenses/
                │   └── {yyyy}/
                │       └── {expense_id}/
                │           └── bill.{ext}
                ├── members/
                │   └── {member_id}/
                │       └── {doc_id}_{safe_name}
                └── misc/
                    └── {uuid}_{safe_name}
```

## Rules

- Path **always** includes `tenant_id` + `society_id` (enforce in Nest before upload).
- `documents.storage_path` stores the full object key; `url` is signed or CDN.
- RLS on Storage (Supabase): policy path starts with `tenants/{jwt_tenant}/societies/{jwt_society}/`.
- Virus/size limits at API gateway; max PDF 10 MB.
- Lifecycle: move invoices/receipts older than 24 months to Glacier-class if needed (optional).
