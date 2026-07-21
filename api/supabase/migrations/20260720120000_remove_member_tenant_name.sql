-- Remove occupant "tenant name" from members; app login is via linked users table.

DROP VIEW IF EXISTS v_resident_details;

CREATE VIEW v_resident_details AS
SELECT
  m.id AS member_id,
  m.tenant_id,
  m.society_id,
  m.owner_name,
  m.email,
  m.phone,
  m.is_active,
  f.flat_no,
  w.code AS wing_code,
  f.parking,
  app.member_outstanding(m.id) AS outstanding_total,
  s.name AS society_name,
  u.id AS user_id,
  (u.id IS NOT NULL AND u.is_active) AS has_app_login
FROM members m
JOIN societies s ON s.id = m.society_id
LEFT JOIN users u ON u.member_id = m.id AND u.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT mf.flat_id
  FROM member_flats mf
  WHERE mf.member_id = m.id AND mf.deleted_at IS NULL AND mf.is_primary
  ORDER BY mf.valid_from DESC
  LIMIT 1
) pmf ON true
LEFT JOIN flats f ON f.id = pmf.flat_id
LEFT JOIN wings w ON w.id = f.wing_id
WHERE m.deleted_at IS NULL;

ALTER TABLE members DROP COLUMN IF EXISTS tenant_name;
