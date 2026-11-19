-- Public directory (FSD 2.1, 5.2): which businesses customers can find on the Portal.
--
-- Deciding whether a tenant is bookable needs its branches, therapists, working hours and
-- services: tenant-owned tables that row-level security (correctly) hides from the API
-- without a tenant context. These SECURITY DEFINER functions run as the table owner, which
-- RLS does not apply to, and return only public facts: a yes/no, names and slugs. They
-- never return rows of the protected tables, so the isolation guarantees stay intact.
-- `search_path` is pinned so a malicious object in another schema cannot be picked up.

-- A tenant is bookable once an active therapist at an active branch has working hours and
-- performs an active service (FSD 3.4 step 3; the Console's setup status uses the same rule).
CREATE FUNCTION tenant_is_bookable(p_tenant_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM memberships m
      JOIN branches b ON b.id = m.branch_id AND b.archived_at IS NULL
      WHERE m.tenant_id = p_tenant_id
        AND m.status = 'active'
        AND EXISTS (SELECT 1 FROM staff_working_hours w WHERE w.membership_id = m.id)
        AND EXISTS (
          SELECT 1 FROM staff_services ss
          JOIN services s ON s.id = ss.service_id AND s.archived_at IS NULL
          WHERE ss.membership_id = m.id
        )
    )
  $$;

-- Directory search by business or service name. `p_query` is a LIKE pattern already escaped
-- by the API (so `%` and `_` typed by a visitor are literal); NULL lists everything.
CREATE FUNCTION public_directory(p_query text, p_limit integer)
  RETURNS TABLE (slug varchar, name varchar, branch_names varchar[], service_names varchar[])
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      t.slug,
      t.name,
      ARRAY(SELECT b.name FROM branches b WHERE b.tenant_id = t.id AND b.archived_at IS NULL ORDER BY b.name),
      ARRAY(SELECT s.name FROM services s WHERE s.tenant_id = t.id AND s.archived_at IS NULL ORDER BY s.name)
    FROM tenants t
    WHERE t.status = 'active'
      AND t.archived_at IS NULL
      AND tenant_is_bookable(t.id)
      AND (
        p_query IS NULL
        OR t.name ILIKE '%' || p_query || '%'
        OR EXISTS (
          SELECT 1 FROM services s
          WHERE s.tenant_id = t.id AND s.archived_at IS NULL AND s.name ILIKE '%' || p_query || '%'
        )
      )
    ORDER BY t.name
    LIMIT p_limit
  $$;

-- Functions are executable by everyone by default; allow only the API.
REVOKE ALL ON FUNCTION tenant_is_bookable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public_directory(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_is_bookable(uuid) TO tempora_app;
GRANT EXECUTE ON FUNCTION public_directory(text, integer) TO tempora_app;
