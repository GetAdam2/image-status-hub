
CREATE TYPE public.case_status AS ENUM ('open', 'closed');

CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL,
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_date DATE,
  defendant_name TEXT,
  defendant_address TEXT,
  plaintiff_name TEXT,
  plaintiff_address TEXT,
  subject TEXT,
  notes TEXT,
  status public.case_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO anon, authenticated;
GRANT ALL ON public.cases TO service_role;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view cases" ON public.cases FOR SELECT USING (true);
CREATE POLICY "Public can insert cases" ON public.cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update cases" ON public.cases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete cases" ON public.cases FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_case_number ON public.cases(case_number);
