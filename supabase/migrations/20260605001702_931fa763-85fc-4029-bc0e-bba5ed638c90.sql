CREATE TABLE public.water_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ml integer NOT NULL,
  eaten_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'::text))::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_entries TO authenticated;
GRANT ALL ON public.water_entries TO service_role;
ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own water" ON public.water_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX water_entries_user_date_idx ON public.water_entries(user_id, eaten_on);