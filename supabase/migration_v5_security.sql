-- Review and test on a staging copy before production. No data reset or role
-- reassignment is performed. Existing profiles and auth users are preserved.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_active_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = (SELECT auth.uid()) AND p.status = 'ACTIVE'
$$;
REVOKE ALL ON FUNCTION public.current_active_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_active_role() TO authenticated, anon;

-- Never trust client-supplied signup metadata for authorization.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'EMPLOYEE'::public.user_role);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Replace the recursive profile policy. Service-role operations bypass RLS;
-- ordinary staff cannot promote themselves by calling PostgREST directly.
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
CREATE POLICY "Admin full access" ON public.profiles FOR ALL TO authenticated
  USING (public.current_active_role() = 'ADMIN')
  WITH CHECK (public.current_active_role() = 'ADMIN');
DROP POLICY IF EXISTS "Staff directory managers" ON public.profiles;
CREATE POLICY "Staff directory managers" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_active_role() IN ('ADMIN', 'LEADER'));

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Profile identity cannot be changed';
  END IF;
  IF (NEW.role, NEW.status) IS DISTINCT FROM (OLD.role, OLD.status)
     AND OLD.id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Cannot change own access privileges';
  END IF;
  IF (NEW.email, NEW.role, NEW.status, NEW.can_input_revenue, NEW.join_date, NEW.created_at)
     IS DISTINCT FROM (OLD.email, OLD.role, OLD.status, OLD.can_input_revenue, OLD.join_date, OLD.created_at)
     AND public.current_active_role() IS DISTINCT FROM 'ADMIN'::public.user_role THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only an active administrator may change privileges';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_privileges() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- A restrictive policy combines with existing permissive business policies.
-- It blocks suspended/inactive/anonymous identities even when a historical
-- table policy was USING(true). Definer helpers read only the caller's role.
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Active staff required" ON public.%I', target.relname);
    EXECUTE format('CREATE POLICY "Active staff required" ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (public.current_active_role() IS NOT NULL) WITH CHECK (public.current_active_role() IS NOT NULL)', target.relname);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "All access campaign_mapping" ON public.campaign_subid_mapping;
DROP POLICY IF EXISTS "Managers edit campaign mapping" ON public.campaign_subid_mapping;
CREATE POLICY "Managers edit campaign mapping" ON public.campaign_subid_mapping FOR ALL TO authenticated
  USING (public.current_active_role() IN ('ADMIN', 'LEADER'))
  WITH CHECK (public.current_active_role() IN ('ADMIN', 'LEADER'));
DROP POLICY IF EXISTS "Assigned mapping read" ON public.campaign_subid_mapping;
CREATE POLICY "Assigned mapping read" ON public.campaign_subid_mapping FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pages p WHERE p.id = page_id AND p.assignee_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "All access page_assignments" ON public.page_assignments;
DROP POLICY IF EXISTS "Managers edit assignments" ON public.page_assignments;
CREATE POLICY "Managers edit assignments" ON public.page_assignments FOR ALL TO authenticated
  USING (public.current_active_role() IN ('ADMIN', 'LEADER'))
  WITH CHECK (public.current_active_role() IN ('ADMIN', 'LEADER'));
DROP POLICY IF EXISTS "Own assignment read" ON public.page_assignments;
CREATE POLICY "Own assignment read" ON public.page_assignments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Existing views must respect the caller's table policies instead of executing
-- with the view owner's privileges. This requires PostgreSQL 15+ (Supabase).
DO $$
DECLARE target record;
BEGIN
  FOR target IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', target.table_name);
  END LOOP;
END;
$$;
COMMIT;
