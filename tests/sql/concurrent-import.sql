\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
BEGIN;
SELECT * FROM public.import_report_batch_v1('concurrent-fixture.csv','fb_ads',
 '10000000-0000-0000-0000-000000000001',CURRENT_DATE,
 '[{"campaign_name":"concurrent-fixture","ad_spend":47.50}]');
-- Hold the unique identity so the second client must serialize with this one.
SELECT pg_sleep(1);
COMMIT;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.import_batches WHERE filename='concurrent-fixture.csv')<>1 THEN
  RAISE EXCEPTION 'FAIL: concurrent import created duplicate batches';
 END IF;
 IF (SELECT count(*) FROM public.fb_ads_data WHERE campaign_name='concurrent-fixture')<>1 THEN
  RAISE EXCEPTION 'FAIL: concurrent import created duplicate details';
 END IF;
END $$;
SELECT 'PASS: concurrent clients retain exactly one batch and one detail' AS result;
