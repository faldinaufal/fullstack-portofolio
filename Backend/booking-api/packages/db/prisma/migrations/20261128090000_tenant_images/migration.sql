-- Business images (FSD 6.15): object keys of the logo and cover photo. Only the key is
-- stored; the API builds the public URL, so moving storage never needs a data migration.
ALTER TABLE "tenants" ADD COLUMN "logo_key" VARCHAR(200),
                      ADD COLUMN "cover_key" VARCHAR(200);

-- The directory now also returns the logo key. A function's result columns cannot be
-- changed in place, so it is dropped and created again (same rules as before).
DROP FUNCTION public_directory(text, integer);

CREATE FUNCTION public_directory(p_query text, p_limit integer)
  RETURNS TABLE (
    slug varchar,
    name varchar,
    branch_names varchar[],
    service_names varchar[],
    logo_key varchar
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      t.slug,
      t.name,
      ARRAY(SELECT b.name FROM branches b WHERE b.tenant_id = t.id AND b.archived_at IS NULL ORDER BY b.name),
      ARRAY(SELECT s.name FROM services s WHERE s.tenant_id = t.id AND s.archived_at IS NULL ORDER BY s.name),
      t.logo_key
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

REVOKE ALL ON FUNCTION public_directory(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_directory(text, integer) TO tempora_app;
