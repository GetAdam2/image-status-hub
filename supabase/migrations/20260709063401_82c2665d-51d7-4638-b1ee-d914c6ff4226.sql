
DO $$ BEGIN
  CREATE TYPE public.letter_type AS ENUM ('incoming','outgoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS letter_type public.letter_type NOT NULL DEFAULT 'incoming',
  ADD COLUMN IF NOT EXISTS letter_date DATE,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_office TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_office TEXT,
  ADD COLUMN IF NOT EXISTS file_reference TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT;
