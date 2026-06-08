import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, LogOut, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_LABELS, calcDailyTarget, type Activity, type Sex } from "@/lib/calorie-calc";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Perfil — Calora" }] }),
  component: SettingsPage,
});

type Profile = {
  display_name: string | null;
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: Activity | null;
  goal_pace_kg_per_week: number | null;
  daily_calorie_target: number | null;
};

function SettingsPage() {
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("display_name, age, sex, height_cm, weight_kg, target_weight_kg, activity_level, goal_pace_kg_per_week, daily_calorie_target")
        .eq("id", u.user.id)
        .maybeSingle();
      setP((data as Profile) ?? null);
    })();
  }, []);

  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!p) return;
    if (!p.age || !p.sex || !p.height_cm || !p.weight_kg || !p.target_weight_kg || !p.activity_level) {
      return toast.error("Preencha todos os campos");
    }
    setSaving(true);
    const target = calcDailyTarget({
      sex: p.sex,
      weightKg: Number(p.weight_kg),
      heightCm: Number(p.height_cm),
      age: Number(p.age),
      activity: p.activity_level,
      goalPaceKgPerWeek: Number(p.goal_pace_kg_per_week ?? 0.5),
      targetWeightKg: Number(p.target_weight_kg),
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: p.display_name,
      age: p.age,
      sex: p.sex,
      height_cm: p.height_cm,
      weight_kg: p.weight_kg,
      target_weight_kg: p.target_weight_kg,
      activity_level: p.activity_level,
      goal_pace_kg_per_week: p.goal_pace_kg_per_week,
      daily_calorie_target: target,
    }).eq("id", u.user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    update("daily_calorie_target", target);
    toast.success(`Meta atualizada: ${target} kcal/dia`);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!p) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/app"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <h1 className="font-semibold">Perfil</h1>
          </div>
          <Link to="/history"><Button variant="ghost" size="icon" aria-label="Histórico"><BarChart3 className="w-5 h-5" /></Button></Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5 shadow-card bg-gradient-surface">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Meta diária</p>
          <p className="text-4xl font-bold text-primary mt-1">{p.daily_calorie_target ?? "—"}<span className="text-base text-muted-foreground font-normal"> kcal</span></p>
          <p className="text-xs text-muted-foreground mt-2">{email}</p>
        </Card>

        <Card className="p-5 shadow-card space-y-4">
          <h3 className="font-semibold">Dados</h3>

          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={p.display_name ?? ""} onChange={(e) => update("display_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age">Idade</Label>
              <Input id="age" type="number" min={10} max={100} value={p.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select value={p.sex ?? undefined} onValueChange={(v) => update("sex", v as Sex)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h">Altura (cm)</Label>
              <Input id="h" type="number" value={p.height_cm ?? ""} onChange={(e) => update("height_cm", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w">Peso atual (kg)</Label>
              <Input id="w" type="number" step="0.1" value={p.weight_kg ?? ""} onChange={(e) => update("weight_kg", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tw">Meta de peso (kg)</Label>
              <Input id="tw" type="number" step="0.1" value={p.target_weight_kg ?? ""} onChange={(e) => update("target_weight_kg", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ritmo (kg/semana)</Label>
              <Select value={String(p.goal_pace_kg_per_week ?? 0.5)} onValueChange={(v) => update("goal_pace_kg_per_week", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Manter peso</SelectItem>
                  <SelectItem value="0.25">0,25 kg (suave)</SelectItem>
                  <SelectItem value="0.5">0,5 kg (recomendado)</SelectItem>
                  <SelectItem value="0.75">0,75 kg (agressivo)</SelectItem>
                  <SelectItem value="1">1,0 kg (muito agressivo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nível de atividade</Label>
            <Select value={p.activity_level ?? undefined} onValueChange={(v) => update("activity_level", v as Activity)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                  <SelectItem key={a} value={a}>{ACTIVITY_LABELS[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {saving ? "Salvando…" : "Salvar e recalcular meta"}
          </Button>
        </Card>

        <Button variant="outline" onClick={logout} className="w-full">
          <LogOut className="w-4 h-4 mr-2" /> Sair da conta
        </Button>
      </main>
      <BottomNav />
    </div>
  );
}
