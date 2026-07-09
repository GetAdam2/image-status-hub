-- Expand status enum
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'waiting_approval';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'approved';

-- Add new columns for the Incoming Letter Registration Form
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS letter_reference_number TEXT,
  ADD COLUMN IF NOT EXISTS received_date DATE,
  ADD COLUMN IF NOT EXISTS sender_organization TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS assigned_department TEXT,
  ADD COLUMN IF NOT EXISTS responsible_person TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_date DATE,
  ADD COLUMN IF NOT EXISTS approving_officer TEXT,
  ADD COLUMN IF NOT EXISTS signature_text TEXT,
  ADD COLUMN IF NOT EXISTS signature_file_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Auto-generate serial number sequence
CREATE SEQUENCE IF NOT EXISTS public.cases_serial_seq START 1;

CREATE OR REPLACE FUNCTION public.set_case_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    NEW.serial_number := 'SN-' || LPAD(nextval('public.cases_serial_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_case_serial_trigger ON public.cases;
CREATE TRIGGER set_case_serial_trigger
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_case_serial();
