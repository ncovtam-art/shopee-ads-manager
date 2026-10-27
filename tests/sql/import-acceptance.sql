\set ON_ERROR_STOP on
-- Run after security-acceptance.sql on the disposable fixture only.
ALTER TABLE public.fb_ads_data ADD CONSTRAINT fixture_import_failure CHECK(campaign_name<>'failure-fixture');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE first_result record; retry_result record; count_before bigint; deleted integer;
BEGIN
 SELECT * INTO first_result FROM public.import_report_batch_v1('first.csv','fb_ads',
  '10000000-0000-0000-0000-000000000001',CURRENT_DATE,
  '[{"campaign_name":"Atomic A","ad_spend":10.20},{"campaign_name":"Atomic B","ad_spend":20.30}]');
 IF first_result.duplicate OR first_result.imported_rows<>2 THEN RAISE EXCEPTION 'FAIL: initial atomic import'; END IF;
 SELECT * INTO retry_result FROM public.import_report_batch_v1('renamed.csv','fb_ads',
  '10000000-0000-0000-0000-000000000001',CURRENT_DATE,
  '[{"campaign_name":"Atomic B","ad_spend":20.3},{"campaign_name":"Atomic A","ad_spend":10.2}]');
 IF NOT retry_result.duplicate OR retry_result.batch_id<>first_result.batch_id THEN RAISE EXCEPTION 'FAIL: renamed/reordered duplicate'; END IF;
 IF (SELECT count(*) FROM public.fb_ads_data WHERE batch_id=first_result.batch_id)<>2 THEN RAISE EXCEPTION 'FAIL: duplicate details'; END IF;
 IF (SELECT sum(ad_spend) FROM public.fb_ads_data WHERE batch_id=first_result.batch_id)<>30.50 THEN RAISE EXCEPTION 'FAIL: decimal amount'; END IF;

 SELECT * INTO retry_result FROM public.import_report_batch_v1('affiliate.csv','shopee_affiliate',
  '10000000-0000-0000-0000-000000000001',CURRENT_DATE,
  '[{"sub_id1":"Page A","sub_id2":"Atomic A","channel":"fixture","order_value":100,"net_commission":-1}]');
 IF (SELECT matched_rows FROM public.import_batches WHERE id=retry_result.batch_id)<>1 THEN RAISE EXCEPTION 'FAIL: actual campaign match'; END IF;
 IF (SELECT net_commission FROM public.shopee_affiliate_data WHERE batch_id=retry_result.batch_id)<>-1 THEN RAISE EXCEPTION 'FAIL: negative adjustment lost'; END IF;

 SELECT count(*) INTO count_before FROM public.import_batches;
 BEGIN
  PERFORM public.import_report_batch_v1('failed.csv','fb_ads','10000000-0000-0000-0000-000000000001',CURRENT_DATE,
   '[{"campaign_name":"failure-fixture","ad_spend":1}]');
  RAISE EXCEPTION 'FAIL: simulated detail failure was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT count(*) FROM public.import_batches)<>count_before THEN RAISE EXCEPTION 'FAIL: failed import retained metadata'; END IF;
 IF EXISTS(SELECT 1 FROM public.fb_ads_data WHERE campaign_name='failure-fixture') THEN RAISE EXCEPTION 'FAIL: failed import retained detail'; END IF;
 BEGIN
  PERFORM public.import_report_batch_v1('invalid.csv','fb_ads','10000000-0000-0000-0000-000000000001',CURRENT_DATE,
   '[{"campaign_name":"invalid","ad_spend":1,"role":"ADMIN"}]');
  RAISE EXCEPTION 'FAIL: unexpected fields accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.delete_import_batches_v1(ARRAY[first_result.batch_id,'99999999-0000-0000-0000-000000000000'::uuid]);
  RAISE EXCEPTION 'FAIL: partial selection deleted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.import_batches WHERE id=first_result.batch_id) THEN RAISE EXCEPTION 'FAIL: partial delete changed data'; END IF;
 SELECT public.delete_import_batches_v1(ARRAY[first_result.batch_id,retry_result.batch_id]) INTO deleted;
 IF deleted<>2 OR EXISTS(SELECT 1 FROM public.fb_ads_data WHERE batch_id=first_result.batch_id)
   OR EXISTS(SELECT 1 FROM public.shopee_affiliate_data WHERE batch_id=retry_result.batch_id) THEN
  RAISE EXCEPTION 'FAIL: atomic cascade deletion';
 END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
 BEGIN
  PERFORM public.import_report_batch_v1('employee.csv','fb_ads','10000000-0000-0000-0000-000000000001',CURRENT_DATE,
   '[{"campaign_name":"forbidden","ad_spend":1}]');
  RAISE EXCEPTION 'FAIL: employee import allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.delete_import_batches_v1(ARRAY['99999999-0000-0000-0000-000000000000'::uuid]);
  RAISE EXCEPTION 'FAIL: employee deletion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ALTER TABLE public.fb_ads_data DROP CONSTRAINT fixture_import_failure;
SELECT 'PASS: atomic import, duplicate retry, decimal amounts, rollback, role scope and cascade deletion' AS result;
