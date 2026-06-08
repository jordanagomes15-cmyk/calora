import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/history")({
  ssr: false,
  head: () => ({ meta: [{ title: "Histórico — Calora" }] }),
  component: History,
});

type Row = { eaten_on: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; food_name: string; grams: number; meal_type: string };

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function History() {
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState(2000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from("profiles").select("daily_calorie_target").eq("id", u.user.id).maybeSingle(),
        supabase.from("meal_entries").select("eaten_on, calories, protein_g, carbs_g, fat_g, food_name, grams, meal_type").eq("user_id", u.user.id).gte("eaten_on", dateStr(since)).order("eaten_on"),
      ]);
      if (p?.daily_calorie_target) setTarget(p.daily_calorie_target);
      setRows((e as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Build last 7 days chart
  const last7: { day: string; kcal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateStr(d);
    const kcal = rows.filter((r) => r.eaten_on === key).reduce((a, r) => a + Number(r.calories), 0);
    last7.push({ day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), kcal: Math.round(kcal) });
  }

  const avg7 = Math.round(last7.reduce((a, d) => a + d.kcal, 0) / 7);

  function exportCsv() {
    if (rows.length === 0) return toast.error("Nada para exportar");
    const header = ["data", "refeicao", "alimento", "gramas", "kcal", "proteina_g", "carbo_g", "gordura_g"];
    const lines = rows.map((r) => [r.eaten_on, r.meal_type, `"${r.food_name.replace(/"/g, '""')}"`, r.grams, r.calories, r.protein_g, r.carbs_g, r.fat_g].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calora-refeicoes-${dateStr(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/app"><Button size="icon" variant="ghost"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <h1 className="font-semibold">Histórico</h1>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5 shadow-card bg-gradient-surface">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Últimos 7 dias</p>
              <p className="text-2xl font-bold mt-1">{avg7} <span className="text-sm text-muted-foreground font-normal">kcal/dia (média)</span></p>
            </div>
            <p className="text-xs text-muted-foreground">Meta {target}</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <ReferenceLine y={target} stroke="var(--primary)" strokeDasharray="4 4" />
                <Bar dataKey="kcal" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-3">Últimos 30 dias</h3>
          <ul className="divide-y divide-border">
            {Array.from(new Set(rows.map((r) => r.eaten_on))).sort().reverse().map((day) => {
              const dayRows = rows.filter((r) => r.eaten_on === day);
              const kcal = dayRows.reduce((a, r) => a + Number(r.calories), 0);
              return (
                <li key={day} className="py-2 flex items-center justify-between">
                  <span className="text-sm">{new Date(day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" })}</span>
                  <span className="text-sm font-semibold text-primary">{Math.round(kcal)} kcal</span>
                </li>
              );
            })}
            {rows.length === 0 && <li className="py-4 text-sm text-muted-foreground text-center">Sem registros ainda.</li>}
          </ul>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
