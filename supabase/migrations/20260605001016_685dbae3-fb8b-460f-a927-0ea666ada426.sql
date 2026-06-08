
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  age INT,
  sex TEXT CHECK (sex IN ('male','female')),
  height_cm NUMERIC,
  weight_kg NUMERIC,
  target_weight_kg NUMERIC,
  activity_level TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  goal_pace_kg_per_week NUMERIC DEFAULT 0.5,
  daily_calorie_target INT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- FOODS catalog
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  calories_per_100g NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  default_serving_g NUMERIC NOT NULL DEFAULT 100,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX foods_name_idx ON public.foods USING gin (to_tsvector('simple', name));
CREATE INDEX foods_name_trgm ON public.foods (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated reads foods" ON public.foods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create custom foods" ON public.foods FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND is_custom = true);
CREATE POLICY "Users update own custom foods" ON public.foods FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users delete own custom foods" ON public.foods FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- MEAL ENTRIES
CREATE TABLE public.meal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  food_id UUID REFERENCES public.foods ON DELETE SET NULL,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  grams NUMERIC NOT NULL,
  calories NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  eaten_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meal_entries_user_day ON public.meal_entries (user_id, eaten_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_entries TO authenticated;
GRANT ALL ON public.meal_entries TO service_role;
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own entries" ON public.meal_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
