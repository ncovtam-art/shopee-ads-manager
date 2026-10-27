-- Additive, review on a restored staging database first. Never resets data.
BEGIN;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS report_date date;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS import_batches_content_identity
  ON public.import_batches(page_id, type, report_date, content_hash)
  WHERE content_hash IS NOT NULL;

-- Deleting a batch is atomic only when details cascade in the existing schema.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.fb_ads_data'::regclass AND confrelid='public.import_batches'::regclass AND confdeltype='c')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.shopee_affiliate_data'::regclass AND confrelid='public.import_batches'::regclass AND confdeltype='c') THEN
    RAISE EXCEPTION 'Review batch foreign keys before enabling atomic deletes';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.import_report_batch_v1(
  p_filename text, p_type text, p_page_id uuid, p_report_date date, p_rows jsonb
)
RETURNS TABLE(batch_id uuid, duplicate boolean, imported_rows integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE normalized jsonb; fingerprint text; result_id uuid; row_count integer; matched_count integer;
BEGIN
  IF public.current_active_role() IS NULL OR public.current_active_role() NOT IN ('ADMIN','LEADER') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Active manager access required';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('fb_ads','shopee_affiliate')
     OR p_filename IS NULL OR length(btrim(p_filename)) NOT BETWEEN 1 AND 255
     OR p_report_date IS NULL OR p_report_date > CURRENT_DATE
     OR p_page_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pages WHERE id=p_page_id) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid report metadata or inaccessible page';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Report rows must be an array';
  END IF;
  row_count := jsonb_array_length(p_rows);
  IF row_count NOT BETWEEN 1 AND 10000 OR octet_length(p_rows::text) > 8388608 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Report exceeds row or byte limit';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) v WHERE jsonb_typeof(v) IS DISTINCT FROM 'object') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid row shape';
  END IF;

  IF p_type='fb_ads' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) v WHERE
       jsonb_typeof(v->'campaign_name') IS DISTINCT FROM 'string'
       OR length(btrim(v->>'campaign_name')) NOT BETWEEN 1 AND 512
       OR jsonb_typeof(v->'ad_spend') IS DISTINCT FROM 'number'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) AS keys(key) WHERE key NOT IN ('campaign_name','ad_spend'))) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid advertising row';
    END IF;
    SELECT jsonb_agg(n ORDER BY n::text) INTO normalized FROM (
      SELECT jsonb_build_object('campaign_name',btrim(v->>'campaign_name'),'ad_spend',(v->>'ad_spend')::numeric(15,2)) n
      FROM jsonb_array_elements(p_rows) v
    ) normalized_rows;
    matched_count := row_count;
  ELSE
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) v WHERE
       jsonb_typeof(v->'sub_id1') IS DISTINCT FROM 'string' OR length(v->>'sub_id1')>512
       OR jsonb_typeof(v->'sub_id2') IS DISTINCT FROM 'string' OR length(v->>'sub_id2')>512
       OR jsonb_typeof(v->'channel') IS DISTINCT FROM 'string' OR length(v->>'channel')>128
       OR jsonb_typeof(v->'order_value') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v->'net_commission') IS DISTINCT FROM 'number'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) AS keys(key) WHERE key NOT IN ('sub_id1','sub_id2','channel','order_value','net_commission'))) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid affiliate row';
    END IF;
    SELECT jsonb_agg(n ORDER BY n::text) INTO normalized FROM (
      SELECT jsonb_build_object('sub_id1',btrim(v->>'sub_id1'),'sub_id2',btrim(v->>'sub_id2'),
        'channel',btrim(v->>'channel'),'order_value',(v->>'order_value')::numeric(15,2),
        'net_commission',(v->>'net_commission')::numeric(15,2)) n
      FROM jsonb_array_elements(p_rows) v
    ) normalized_rows;
    SELECT count(*)::integer INTO matched_count FROM jsonb_array_elements(normalized) v
      WHERE EXISTS (SELECT 1 FROM public.fb_ads_data f WHERE f.page_id=p_page_id AND f.campaign_name=v->>'sub_id2');
  END IF;
  fingerprint := encode(sha256(convert_to(normalized::text,'UTF8')),'hex');
  INSERT INTO public.import_batches(filename,type,total_rows,matched_rows,unmatched_rows,status,created_by,page_id,report_date,content_hash)
    VALUES(btrim(p_filename),p_type,row_count,matched_count,row_count-matched_count,'PROCESSING',auth.uid(),p_page_id,p_report_date,fingerprint)
    ON CONFLICT(page_id,type,report_date,content_hash) WHERE content_hash IS NOT NULL DO NOTHING
    RETURNING id INTO result_id;
  IF result_id IS NULL THEN
    SELECT b.id INTO result_id FROM public.import_batches b WHERE b.page_id=p_page_id AND b.type=p_type
      AND b.report_date=p_report_date AND b.content_hash=fingerprint AND b.status='COMPLETED';
    IF result_id IS NULL THEN RAISE EXCEPTION 'Existing report is not complete; review required'; END IF;
    RETURN QUERY SELECT result_id,true,row_count;
    RETURN;
  END IF;
  IF p_type='fb_ads' THEN
    INSERT INTO public.fb_ads_data(batch_id,campaign_name,ad_spend,page_id,report_date)
      SELECT result_id,v->>'campaign_name',(v->>'ad_spend')::numeric,p_page_id,p_report_date
      FROM jsonb_array_elements(normalized) v;
  ELSE
    INSERT INTO public.shopee_affiliate_data(batch_id,sub_id1,sub_id2,channel,order_value,net_commission,page_id,report_date)
      SELECT result_id,v->>'sub_id1',v->>'sub_id2',v->>'channel',(v->>'order_value')::numeric,
        (v->>'net_commission')::numeric,p_page_id,p_report_date FROM jsonb_array_elements(normalized) v;
  END IF;
  UPDATE public.import_batches SET status='COMPLETED' WHERE id=result_id;
  RETURN QUERY SELECT result_id,false,row_count;
END;
$$;
REVOKE ALL ON FUNCTION public.import_report_batch_v1(text,text,uuid,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_report_batch_v1(text,text,uuid,date,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_import_batches_v1(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE affected integer; expected integer;
BEGIN
  IF public.current_active_role() IS NULL OR public.current_active_role() NOT IN ('ADMIN','LEADER') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Active manager access required';
  END IF;
  expected := cardinality(p_ids);
  IF expected IS NULL OR expected NOT BETWEEN 1 AND 1000 OR array_position(p_ids,NULL) IS NOT NULL
     OR (SELECT count(DISTINCT id) FROM unnest(p_ids) id)<>expected THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid batch selection';
  END IF;
  PERFORM 1 FROM public.import_batches WHERE id=ANY(p_ids) AND type IN ('fb_ads','shopee_affiliate') FOR UPDATE;
  IF (SELECT count(*) FROM public.import_batches WHERE id=ANY(p_ids) AND type IN ('fb_ads','shopee_affiliate'))<>expected THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Batch selection changed or access denied';
  END IF;
  DELETE FROM public.import_batches WHERE id=ANY(p_ids) AND type IN ('fb_ads','shopee_affiliate');
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>expected THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Batch deletion incomplete'; END IF;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_import_batches_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_import_batches_v1(uuid[]) TO authenticated;
COMMIT;
