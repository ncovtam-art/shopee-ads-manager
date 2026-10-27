BEGIN;
CREATE OR REPLACE FUNCTION public.delete_page_v1(p_page_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
  IF public.current_active_role() IS DISTINCT FROM 'ADMIN'::public.user_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Active administrator required';
  END IF;
  PERFORM 1 FROM public.pages WHERE id=p_page_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Page unavailable'; END IF;
  DELETE FROM public.fb_ads_data WHERE page_id=p_page_id;
  DELETE FROM public.shopee_affiliate_data WHERE page_id=p_page_id;
  DELETE FROM public.import_batches WHERE page_id=p_page_id;
  -- Existing business/history foreign keys may refuse deletion. In that case
  -- PostgreSQL rolls back ALL preceding deletes; never clear history silently.
  DELETE FROM public.pages WHERE id=p_page_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Page deletion incomplete'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_page_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_page_v1(uuid) TO authenticated;
COMMIT;
