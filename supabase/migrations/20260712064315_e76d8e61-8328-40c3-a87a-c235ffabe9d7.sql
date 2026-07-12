
-- 1) Install missing triggers on public tables
DROP TRIGGER IF EXISTS cases_enforce_dept_and_reopen ON public.cases;
CREATE TRIGGER cases_enforce_dept_and_reopen
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.enforce_cases_dept_and_reopen();

DROP TRIGGER IF EXISTS cases_audit ON public.cases;
CREATE TRIGGER cases_audit
AFTER INSERT OR UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.log_case_audit();

DROP TRIGGER IF EXISTS cases_set_serial ON public.cases;
CREATE TRIGGER cases_set_serial
BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.set_case_serial();

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS departments_updated_at ON public.departments;
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Fix audit visibility policy (typo: a.case_id = a.case_id)
DROP POLICY IF EXISTS audit_select_admin ON public.case_audit_log;
CREATE POLICY audit_select_admin ON public.case_audit_log FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_audit_log.case_id
      AND public.has_role(auth.uid(), 'department_head')
      AND c.department_id = public.get_user_department(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.case_assignments a
    WHERE a.case_id = case_audit_log.case_id
      AND a.user_id = auth.uid()
  )
);

-- 3) Tighten case_assignments write: dept_head may only assign users in same department
DROP POLICY IF EXISTS case_assignments_write ON public.case_assignments;
CREATE POLICY case_assignments_write ON public.case_assignments FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_assignments.case_id
      AND public.has_role(auth.uid(), 'department_head')
      AND c.department_id = public.get_user_department(auth.uid())
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_assignments.case_id
        AND public.has_role(auth.uid(), 'department_head')
        AND c.department_id = public.get_user_department(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = case_assignments.user_id
        AND ur.department_id = public.get_user_department(auth.uid())
    )
  )
);

-- 4) Cases INSERT policy: ensure dept_head with no dept still blocked cleanly,
--    and allow admin to set any department; keep dept_head restricted to own dept
--    (the BEFORE trigger will auto-fill department_id for dept_heads when NULL)
DROP POLICY IF EXISTS cases_insert_admin_or_head ON public.cases;
CREATE POLICY cases_insert_admin_or_head ON public.cases FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'department_head')
    AND public.get_user_department(auth.uid()) IS NOT NULL
    AND (department_id IS NULL OR department_id = public.get_user_department(auth.uid()))
  )
);

-- 5) Allow authenticated users to read profiles (needed for staff dropdowns and assignment UI)
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT
TO authenticated USING (true);

-- 6) Allow reading user_roles for department members (needed to build assignee dropdowns)
--    Admins already manage; add a read for authenticated so dept_head UI can list peers.
DROP POLICY IF EXISTS user_roles_select_authenticated ON public.user_roles;
CREATE POLICY user_roles_select_authenticated ON public.user_roles FOR SELECT
TO authenticated USING (true);

-- 7) Realtime for cases and assignments so assignees see updates instantly
ALTER TABLE public.cases REPLICA IDENTITY FULL;
ALTER TABLE public.case_assignments REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
