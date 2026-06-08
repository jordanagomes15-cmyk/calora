import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Camera, Search, LogOut, Trash2, Plus, BarChart3, Droplet, Minus } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

type WaterContainer = "glass" | "cup" | "mug" | "bottle_small" | "bottle" | "bottle_large" | "can" | "custom";
const WATER_CONTAINERS: { value: WaterContainer; label: string; ml: number }[] = [
  { value: "glass", label: "Copo (200 ml)", ml: 200 },
  { value: "cup", label: "Xícara (240 ml)", ml: 240 },
  { value: "mug", label: "Caneca (350 ml)", ml: 350 },
  { value: "can", label: "Lata (330 ml)", ml: 330 },
  { value: "bottle_small", label: "Garrafinha (500 ml)", ml: 500 },
  { value: "bottle", label: "Garrafa (600 ml)", ml: 600 },
  { value: "bottle_large", label: "Garrafa grande (1 L)", ml: 1000 },
  { value: "custom", label: "Personalizado (ml)", ml: 0 },
];

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Hoje — Calora" }] }),
  component: Dashboard,
});

type Profile = {
  display_name: string | null;
  daily_calorie_target: number | null;
  onboarded: boolean;
  weight_kg: number | null;
  target_weight_kg: number | null;
};
type Entry = {
  id: string;
  food_name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const MEAL_LABELS = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  dinner: "Jantar",
  snack: "Lanches",
} as const;

import { localDateStr as todayStr } from "@/lib/date";

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [waterContainer, setWaterContainer] = useState<WaterContainer>("glass");
  const [waterQty, setWaterQty] = useState(1);
  const [waterCustomMl, setWaterCustomMl] = useState(250);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: e }, { data: w }] = await Promise.all([
      supabase.from("profiles").select("display_name, daily_calorie_target, onboarded, weight_kg, target_weight_kg").eq("id", u.user.id).maybeSingle(),
      supabase.from("meal_entries").select("id, food_name, meal_type, grams, calories, protein_g, carbs_g, fat_g").eq("user_id", u.user.id).eq("eaten_on", todayStr()).order("created_at"),
      supabase.from("water_entries").select("ml").eq("user_id", u.user.id).eq("eaten_on", todayStr()),
    ]);
    if (p && !p.onboarded) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    setProfile(p as Profile);
    setEntries((e as Entry[]) ?? []);
    setWaterMl(((w as { ml: number }[]) ?? []).reduce((a, r) => a + Number(r.ml), 0));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addWater(ml: number) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (ml < 0) {
      // delete most recent positive entry of same magnitude or any latest
      const { data: latest } = await supabase.from("water_entries").select("id").eq("user_id", u.user.id).eq("eaten_on", todayStr()).order("created_at", { ascending: false }).limit(1);
      if (latest?.[0]) await supabase.from("water_entries").delete().eq("id", latest[0].id);
    } else {
      await supabase.from("water_entries").insert({ user_id: u.user.id, ml, eaten_on: todayStr() });
    }
    load();
  }

  const totals = useMemo(() => {
    return entries.reduce(
      (a, e) => ({
        cal: a.cal + Number(e.calories),
        p: a.p + Number(e.protein_g),
        c: a.c + Number(e.carbs_g),
        f: a.f + Number(e.fat_g),
      }),
      { cal: 0, p: 0, c: 0, f: 0 }
    );
  }, [entries]);

  const target = profile?.daily_calorie_target ?? 2000;
  const remaining = Math.round(target - totals.cal);
  const pct = Math.min(100, Math.round((totals.cal / target) * 100));

  async function deleteEntry(id: string) {
    const { error } = await supabase.from("meal_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((p) => p.filter((e) => e.id !== id));
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  const byMeal = (["breakfast", "lunch", "dinner", "snack"] as const).map((m) => ({
    key: m,
    items: entries.filter((e) => e.meal_type === m),
  }));

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-none">Olá,</p>
              <p className="font-semibold text-sm">{profile?.display_name ?? "atleta"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/history"><Button variant="ghost" size="icon" aria-label="Histórico"><BarChart3 className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Resumo do dia */}
        <Card className="p-6 shadow-card bg-gradient-surface">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Restantes hoje</p>
              <p className="text-4xl font-bold mt-1">
                <span className={remaining < 0 ? "text-destructive" : "text-primary"}>{remaining}</span>
                <span className="text-base text-muted-foreground font-normal"> kcal</span>
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">Meta {target}</p>
              <p className="text-muted-foreground">Consumido {Math.round(totals.cal)}</p>
            </div>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Macro label="Proteína" value={totals.p} unit="g" />
            <Macro label="Carbo" value={totals.c} unit="g" />
            <Macro label="Gordura" value={totals.f} unit="g" />
          </div>
        </Card>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/photo">
            <Button className="w-full h-20 flex-col gap-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Camera className="w-6 h-6" />
              <span className="text-sm font-semibold">Foto da refeição</span>
            </Button>
          </Link>
          <Link to="/search">
            <Button variant="outline" className="w-full h-20 flex-col gap-1 border-2">
              <Search className="w-6 h-6" />
              <span className="text-sm font-semibold">Buscar alimento</span>
            </Button>
          </Link>
        </div>

        {/* Água */}
        <Card className="p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Água</h3>
            </div>
            <p className="text-sm"><span className="font-bold text-primary">{(waterMl / 1000).toFixed(1)}</span><span className="text-muted-foreground"> / 2.0 L</span></p>
          </div>
          <Progress value={Math.min(100, (waterMl / 2000) * 100)} className="h-2 mb-3" />
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <Select value={waterContainer} onValueChange={(v) => setWaterContainer(v as WaterContainer)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WATER_CONTAINERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                step="1"
                value={waterQty}
                onChange={(e) => setWaterQty(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Quantidade"
                className="h-9"
              />
            </div>
            {waterContainer === "custom" && (
              <Input
                type="number"
                min={1}
                step="10"
                value={waterCustomMl}
                onChange={(e) => setWaterCustomMl(Math.max(1, Number(e.target.value) || 0))}
                placeholder="ml por unidade"
                className="h-9"
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-gradient-primary text-primary-foreground"
                onClick={() => {
                  const perUnit = waterContainer === "custom"
                    ? waterCustomMl
                    : WATER_CONTAINERS.find((c) => c.value === waterContainer)!.ml;
                  const total = perUnit * waterQty;
                  if (total > 0) addWater(total);
                }}
              >
                + Adicionar {(() => {
                  const perUnit = waterContainer === "custom"
                    ? waterCustomMl
                    : WATER_CONTAINERS.find((c) => c.value === waterContainer)!.ml;
                  return perUnit * waterQty;
                })()} ml
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addWater(-1)} aria-label="Remover último"><Minus className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>

        {/* Refeições */}
        <div className="space-y-3">
          {byMeal.map(({ key, items }) => {
            const mealCal = items.reduce((a, e) => a + Number(e.calories), 0);
            return (
              <Card key={key} className="p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{MEAL_LABELS[key]}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{Math.round(mealCal)} kcal</span>
                    <Link to="/search" search={{ meal: key }}>
                      <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="w-4 h-4" /></Button>
                    </Link>
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum item ainda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((e) => (
                      <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.food_name}</p>
                          <p className="text-xs text-muted-foreground">{Math.round(Number(e.grams))} g · P {Math.round(Number(e.protein_g))}g · C {Math.round(Number(e.carbs_g))}g · G {Math.round(Number(e.fat_g))}g</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-semibold text-primary">{Math.round(Number(e.calories))}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => deleteEntry(e.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-lg">{Math.round(value)}<span className="text-xs text-muted-foreground font-normal"> {unit}</span></p>
    </div>
  );
}
