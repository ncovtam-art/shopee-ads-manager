\set ON_ERROR_STOP on
INSERT INTO public.pages(id,name) VALUES ('10000000-0000-0000-0000-000000000003','Delete fixture');
INSERT INTO public.pages(id,name) VALUES ('10000000-0000-0000-0000-000000000004','History fixture');
INSERT INTO public.page_assignments(page_id,user_id) VALUES
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 PERFORM public.import_report_batch_v1('delete-fixture.csv','fb_ads','10000000-0000-0000-0000-000000000003',CURRENT_DATE,'[{"campaign_name":"delete-fixture","ad_spend":10}]');
 IF NOT public.delete_page_v1('10000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'FAIL: page not deleted'; END IF;
 IF EXISTS(SELECT 1 FROM public.pages WHERE id='10000000-0000-0000-0000-000000000003')
   OR EXISTS(SELECT 1 FROM public.import_batches WHERE page_id='10000000-0000-0000-0000-000000000003')
   OR EXISTS(SELECT 1 FROM public.fb_ads_data WHERE page_id='10000000-0000-0000-0000-000000000003') THEN
  RAISE EXCEPTION 'FAIL: page deletion left partial data';
 END IF;
 PERFORM public.import_report_batch_v1('history-fixture.csv','fb_ads','10000000-0000-0000-0000-000000000004',CURRENT_DATE,'[{"campaign_name":"history-fixture","ad_spend":20}]');
 BEGIN
  PERFORM public.delete_page_v1('10000000-0000-0000-0000-000000000004');
  RAISE EXCEPTION 'FAIL: historical assignment removed';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.import_batches WHERE page_id='10000000-0000-0000-0000-000000000004')
    OR NOT EXISTS(SELECT 1 FROM public.fb_ads_data WHERE page_id='10000000-0000-0000-0000-000000000004') THEN
  RAISE EXCEPTION 'FAIL: failed page delete removed financial data';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
 BEGIN
  PERFORM public.delete_page_v1('10000000-0000-0000-0000-000000000004');
  RAISE EXCEPTION 'FAIL: leader deleted page';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: page delete is atomic, protects history and rejects non-admin' AS result;
