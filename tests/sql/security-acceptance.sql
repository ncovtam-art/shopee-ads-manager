\set ON_ERROR_STOP on
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-000000000001','admin@fixture.test','{"name":"Admin","role":"ADMIN"}'),
 ('00000000-0000-0000-0000-000000000002','leader@fixture.test','{"name":"Leader","role":"ADMIN"}'),
 ('00000000-0000-0000-0000-000000000003','employee@fixture.test','{"name":"Employee","role":"ADMIN"}'),
 ('00000000-0000-0000-0000-000000000004','inactive@fixture.test','{"name":"Inactive"}'),
 ('00000000-0000-0000-0000-000000000005','other@fixture.test','{"name":"Other"}');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.profiles WHERE role <> 'EMPLOYEE') THEN
   RAISE EXCEPTION 'FAIL: signup metadata granted privileges';
 END IF;
END $$;
UPDATE public.profiles SET role='ADMIN' WHERE id='00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='LEADER' WHERE id='00000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET status='INACTIVE' WHERE id='00000000-0000-0000-0000-000000000004';
INSERT INTO public.pages (id,name,assignee_id) VALUES
 ('10000000-0000-0000-0000-000000000001','Assigned','00000000-0000-0000-0000-000000000003'),
 ('10000000-0000-0000-0000-000000000002','Other','00000000-0000-0000-0000-000000000005');
INSERT INTO public.campaigns (name,page_id,start_date) VALUES ('Fixture','10000000-0000-0000-0000-000000000001',CURRENT_DATE);
INSERT INTO public.campaign_subid_mapping (campaign_name,sub_id2,page_id) VALUES
 ('Assigned','assigned','10000000-0000-0000-0000-000000000001'),
 ('Other','other','10000000-0000-0000-0000-000000000002');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'FAIL: employee directory scope'; END IF;
 IF (SELECT count(*) FROM public.campaign_subid_mapping) <> 1 THEN RAISE EXCEPTION 'FAIL: mapping scope'; END IF;
 BEGIN
   UPDATE public.profiles SET role='ADMIN' WHERE id=auth.uid();
   RAISE EXCEPTION 'FAIL: employee self promotion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.profiles SET can_input_revenue=true WHERE id=auth.uid();
   RAISE EXCEPTION 'FAIL: revenue privilege escalation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.profiles SET status='SUSPENDED' WHERE id=auth.uid();
   RAISE EXCEPTION 'FAIL: own status edit allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.page_assignments(page_id,user_id) VALUES ('10000000-0000-0000-0000-000000000002',auth.uid());
   RAISE EXCEPTION 'FAIL: employee self assignment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.profiles SET name='Employee updated' WHERE id=auth.uid();
 IF (SELECT name FROM public.profiles WHERE id=auth.uid()) <> 'Employee updated' THEN RAISE EXCEPTION 'FAIL: safe own edit'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 5 THEN RAISE EXCEPTION 'FAIL: leader directory'; END IF;
 BEGIN
   UPDATE public.profiles SET role='ADMIN' WHERE id=auth.uid();
   RAISE EXCEPTION 'FAIL: leader self promotion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 5 THEN RAISE EXCEPTION 'FAIL: administrator directory/recursive policy'; END IF;
 UPDATE public.profiles SET phone='fixture' WHERE id='00000000-0000-0000-0000-000000000005';
 IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: administrator safe update'; END IF;
 BEGIN
   UPDATE public.profiles SET status='INACTIVE' WHERE id=auth.uid();
   RAISE EXCEPTION 'FAIL: administrator self lockout allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 0 THEN RAISE EXCEPTION 'FAIL: inactive identity visible'; END IF;
 IF (SELECT count(*) FROM public.campaigns) <> 0 THEN RAISE EXCEPTION 'FAIL: inactive campaign access'; END IF;
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.campaigns) <> 0 THEN RAISE EXCEPTION 'FAIL: anonymous campaign access'; END IF;
 IF (SELECT count(*) FROM public.profiles) <> 0 THEN RAISE EXCEPTION 'FAIL: anonymous profile access'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: signup, RLS scopes, self-promotion, identity status, profile edits and anonymous isolation' AS result;
