
-- 1. Roles enum & departments
CREATE TYPE public.app_role AS ENUM ('admin', 'department_head', 'employee');

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 2. user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.user_roles
  WHERE user_id = _user_id AND department_id IS NOT NULL LIMIT 1;
$$;

-- 4. Add department_id to cases
ALTER TABLE public.cases ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 5. case_assignments
CREATE TABLE public.case_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_assignments TO authenticated;
GRANT ALL ON public.case_assignments TO service_role;
ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;

-- 6. can_access_case helper
CREATE OR REPLACE FUNCTION public.can_access_case(_user_id uuid, _case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = _case_id
        AND public.has_role(_user_id, 'department_head')
        AND c.department_id = public.get_user_department(_user_id)
    )
    OR EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = _case_id AND user_id = _user_id);
$$;

-- 7. case_audit_log
CREATE TABLE public.case_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role public.app_role,
  action text NOT NULL,
  previous_status text,
  new_status text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_audit_log TO authenticated;
GRANT ALL ON public.case_audit_log TO service_role;
ALTER TABLE public.case_audit_log ENABLE ROW LEVEL SECURITY;

-- 8. Drop old owner-only cases policies
DROP POLICY IF EXISTS "Users view own cases" ON public.cases;
DROP POLICY IF EXISTS "Users insert own cases" ON public.cases;
DROP POLICY IF EXISTS "Users update own cases" ON public.cases;
DROP POLICY IF EXISTS "Users delete own cases" ON public.cases;

-- 9. New RLS on cases
CREATE POLICY "cases_select_role_scoped" ON public.cases FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'department_head') AND department_id = public.get_user_department(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.case_assignments a WHERE a.case_id = cases.id AND a.user_id = auth.uid())
);

CREATE POLICY "cases_insert_admin_or_head" ON public.cases FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'department_head')
      AND (department_id IS NULL OR department_id = public.get_user_department(auth.uid())))
);

CREATE POLICY "cases_update_admin_or_head" ON public.cases FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'department_head') AND department_id = public.get_user_department(auth.uid()))
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'department_head') AND department_id = public.get_user_department(auth.uid()))
);

CREATE POLICY "cases_delete_admin" ON public.cases FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- 10. Dept-head insert: default department to own; block reopen for non-admin
CREATE OR REPLACE FUNCTION public.enforce_cases_dept_and_reopen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.department_id IS NULL AND public.has_role(auth.uid(), 'department_head') THEN
      NEW.department_id := public.get_user_department(auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'closed' AND NEW.status <> 'closed' AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can reopen a closed case';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER cases_dept_reopen_biu
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.enforce_cases_dept_and_reopen();

-- 11. Audit trigger
CREATE OR REPLACE FUNCTION public.log_case_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_action text;
  v_prev text;
  v_new text;
BEGIN
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := NEW.status::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change' ELSE 'update' END;
    v_prev := OLD.status::text; v_new := NEW.status::text;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_prev := OLD.status::text;
  END IF;
  INSERT INTO public.case_audit_log (case_id, user_id, user_role, action, previous_status, new_status)
  VALUES (COALESCE(NEW.id, OLD.id), auth.uid(), v_role, v_action, v_prev, v_new);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER cases_audit_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.log_case_audit();

-- 12. RLS on user_roles
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 13. RLS on departments
CREATE POLICY "departments_select_all_auth" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_admin_write" ON public.departments FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 14. RLS on case_assignments
CREATE POLICY "case_assignments_select" ON public.case_assignments FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id
    AND public.has_role(auth.uid(), 'department_head')
    AND c.department_id = public.get_user_department(auth.uid()))
);
CREATE POLICY "case_assignments_write" ON public.case_assignments FOR ALL TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id
    AND public.has_role(auth.uid(), 'department_head')
    AND c.department_id = public.get_user_department(auth.uid()))
) WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id
    AND public.has_role(auth.uid(), 'department_head')
    AND c.department_id = public.get_user_department(auth.uid()))
);

-- 15. RLS on audit log
CREATE POLICY "audit_select_admin" ON public.case_audit_log FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id
    AND public.has_role(auth.uid(), 'department_head')
    AND c.department_id = public.get_user_department(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.case_assignments a WHERE a.case_id = case_id AND a.user_id = auth.uid())
);
CREATE POLICY "audit_insert_auth" ON public.case_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- 16. Bootstrap role on signup: first user = admin, otherwise employee
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_any boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_any;
  IF NOT has_any THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- 17. Timestamps trigger for departments
CREATE TRIGGER departments_set_updated
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 18. Backfill: give existing users an 'admin' role if none exists yet (bootstrap)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles)
LIMIT 1;

-- Give remaining users employee role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'employee'::public.app_role FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;
