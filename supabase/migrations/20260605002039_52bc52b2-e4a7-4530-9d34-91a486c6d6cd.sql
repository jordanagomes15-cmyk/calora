CREATE TABLE public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight_kg numeric NOT NULL,
  measured_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'::text))::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, measured_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_entries TO authenticated;
GRANT ALL ON public.weight_entries TO service_role;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own weight" ON public.weight_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX weight_entries_user_date_idx ON public.weight_entries(user_id, measured_on);