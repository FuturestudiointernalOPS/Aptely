-- Simplify and optimize email_queue RLS policies
-- Goals:
-- 1) remove multiple permissive overlapping policies
-- 2) avoid per-row auth.role() re-evaluation using initplan-friendly (select auth.role())

DROP POLICY IF EXISTS "Allow admins to update status" ON public.email_queue;
DROP POLICY IF EXISTS "Allow authenticated users to insert and admins to update" ON public.email_queue;
DROP POLICY IF EXISTS "Allow service role admin access" ON public.email_queue;

CREATE POLICY "email_queue_service_role_all"
ON public.email_queue
AS PERMISSIVE
FOR ALL
TO public
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');
