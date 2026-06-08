import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/weight")({
  ssr: false,
  head: () => ({ meta: [{ title: "Peso — Calora" }] }),
  component: WeightPage,
});

type Entry = { id: string; weight_kg: number; measured_on: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function WeightPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [startWeight, setStartWeight] = useState<number | null>(null);
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from("profiles").select("weight_kg, target_weight_kg").eq("id", u.user.id).maybeSingle(),
      supabase.from("weight_entries").select("id, weight_kg, measured_on").eq("user_id", u.user.id).order("measured_on"),
    ]);
    setTarget(p?.target_weight_kg ?? null);
    setStartWeight(p?.weight_kg ?? null);
    setEntries((e as Entry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const w = Number(value);
    if (!w || w < 20 || w > 400) return toast.error("Peso inválido");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("weight_entries")
      .upsert({ user_id: u.user.id, weight_kg: w, measured_on: todayStr() }, { onConflict: "user_id,measured_on" });
    if (!error) {
      // also keep profile current weight in sync
      await supabase.from("profiles").update({ weight_kg: w }).eq("id", u.user.id);
      toast.success("Peso registrado");
      setValue("");
      await load();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("weight_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((p) => p.filter((e) => e.id !== id));
  }

  const chartData = useMemo(
    () => entries.map((e) => ({
      day: new Date(e.measured_on + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      kg: Number(e.weight_kg),
    })),
    [entries]
  );

  const current = entries.at(-1)?.weight_kg ?? startWeight ?? null;
  const first = entries[0]?.weight_kg ?? startWeight ?? null;
  const delta = current != null && first != null ? Number(current) - Number(first) : 0;
  const toGo = current != null && target != null ? Number(current) - Number(target) : 0;
  const totalPlan = first != null && target != null ? Math.abs(Number(first) - Number(target)) : 0;
  const done = first != null && current != null ? Math.abs(Number(first) - Number(current)) : 0;
  const progressPct = totalPlan > 0 ? Math.min(100, (done / totalPlan) * 100) : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  const yMin = chartData.length ? Math.floor(Math.min(...chartData.map((d) => d.kg)) - 1) : 0;
  const yMax = chartData.length ? Math.ceil(Math.max(...chartData.map((d) => d.kg)) + 1) : 100;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/app"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="font-semibold">Peso</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5 shadow-card bg-gradient-surface">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Peso atual</p>
              <p className="text-4xl font-bold mt-1">
                {current != null ? Number(current).toFixed(1) : "—"}
                <span className="text-base text-muted-foreground font-normal"> kg</span>
              </p>
            </div>
            <div className="text-right text-sm">
              {target != null && <p className="text-muted-foreground">Meta {Number(target).toFixed(1)} kg</p>}
              {delta !== 0 && (
                <p className={`font-semibold flex items-center gap-1 justify-end ${delta < 0 ? "text-primary" : "text-destructive"}`}>
                  {delta < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                </p>
              )}
            </div>
          </div>
          {target != null && (
            <>
              <Progress value={progressPct} className="h-2 mt-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {toGo > 0 ? `Faltam ${toGo.toFixed(1)} kg para a meta` : toGo < 0 ? `${Math.abs(toGo).toFixed(1)} kg abaixo da meta` : "Meta atingida!"}
              </p>
            </>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Registrar peso de hoje</h3>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="w" className="sr-only">Peso (kg)</Label>
              <Input id="w" type="number" step="0.1" min={20} max={400} placeholder="ex: 78.4" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </Card>

        {chartData.length > 1 && (
          <Card className="p-5 shadow-card">
            <h3 className="font-semibold mb-3">Evolução</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[yMin, yMax]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(v: number) => [`${v} kg`, "Peso"]}
                  />
                  {target != null && (
                    <ReferenceLine y={Number(target)} stroke="var(--primary)" strokeDasharray="4 4" label={{ value: "meta", fill: "var(--primary)", fontSize: 11, position: "right" }} />
                  )}
                  <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-2">Histórico</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum registro ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {[...entries].reverse().map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm">{new Date(e.measured_on + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{Number(e.weight_kg).toFixed(1)} kg</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => remove(e.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
