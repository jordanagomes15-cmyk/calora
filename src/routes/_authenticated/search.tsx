import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search as SearchIcon, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type Food = {
  id: string;
  name: string;
  brand: string | null;
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  default_serving_g: number;
};

export const Route = createFileRoute("/_authenticated/search")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { meal?: MealType } => ({
    meal: (["breakfast", "lunch", "dinner", "snack"] as const).includes(s.meal as MealType)
      ? (s.meal as MealType)
      : undefined,
  }),
  head: () => ({ meta: [{ title: "Buscar alimento — Calora" }] }),
  component: SearchPage,
});

type Unit = "g" | "mg" | "kg" | "ml" | "l" | "oz" | "lb" | "tsp" | "tbsp" | "cup" | "glass" | "unit";

const UNIT_OPTIONS: { value: Unit; label: string; toGrams: number | "unit" }[] = [
  { value: "g", label: "Gramas (g)", toGrams: 1 },
  { value: "mg", label: "Miligramas (mg)", toGrams: 0.001 },
  { value: "kg", label: "Quilos (kg)", toGrams: 1000 },
  { value: "ml", label: "Mililitros (ml)", toGrams: 1 },
  { value: "l", label: "Litros (L)", toGrams: 1000 },
  { value: "tsp", label: "Colher de chá (5g)", toGrams: 5 },
  { value: "tbsp", label: "Colher de sopa (15g)", toGrams: 15 },
  { value: "cup", label: "Xícara (240g)", toGrams: 240 },
  { value: "glass", label: "Copo (200ml)", toGrams: 200 },
  { value: "oz", label: "Onça (oz)", toGrams: 28.35 },
  { value: "lb", label: "Libra (lb)", toGrams: 453.6 },
  { value: "unit", label: "Unidade (porção)", toGrams: "unit" },
];

function toGrams(qty: number, unit: Unit, defaultServingG: number) {
  const opt = UNIT_OPTIONS.find((u) => u.value === unit)!;
  if (opt.toGrams === "unit") return qty * (defaultServingG || 100);
  return qty * opt.toGrams;
}

type ComboItem = {
  food: Food;
  grams: number;
  qty: number;
  unit: Unit;
};

function SearchPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const defaultMeal: MealType = search.meal ?? guessMeal();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [recent, setRecent] = useState<Food[]>([]);
  const [combo, setCombo] = useState<ComboItem[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState<Unit>("g");
  const grams = selected ? toGrams(quantity, unit, selected.default_serving_g) : 0;
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: ents } = await supabase
        .from("meal_entries")
        .select("food_id, created_at")
        .eq("user_id", u.user.id)
        .not("food_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = Array.from(new Set((ents ?? []).map((e) => e.food_id as string))).slice(0, 8);
      if (ids.length === 0) return;
      const { data: foods } = await supabase.from("foods").select("*").in("id", ids);
      const ordered = ids.map((id) => (foods as Food[] | null)?.find((f) => f.id === id)).filter(Boolean) as Food[];
      setRecent(ordered);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      const { data } = q
        ? await supabase.from("foods").select("*").ilike("name", `%${q}%`).order("name").limit(30)
        : await supabase.from("foods").select("*").order("name").limit(30);
      setResults((data as Food[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function buildEntryRow(item: ComboItem) {
    const factor = item.grams / 100;
    return {
      food_id: item.food.id,
      food_name: item.food.name,
      grams: item.grams,
      calories: Math.round(item.food.calories_per_100g * factor),
      protein_g: +(item.food.protein_g * factor).toFixed(1),
      carbs_g: +(item.food.carbs_g * factor).toFixed(1),
      fat_g: +(item.food.fat_g * factor).toFixed(1),
    };
  }

  function addToCombo() {
    if (!selected) return;
    setCombo((c) => [...c, { food: selected, grams, qty: quantity, unit }]);
    toast.success(`${selected.name} adicionado ao combo`);
    setSelected(null);
    setQuantity(100);
    setUnit("g");
  }

  async function saveAll(items: ComboItem[]) {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário");
      const { localDateStr } = await import("@/lib/date");
      const eaten_on = localDateStr();
      const rows = items.map((it) => ({
        ...buildEntryRow(it),
        user_id: u.user!.id,
        meal_type: meal,
        eaten_on,
      }));
      const { error } = await supabase.from("meal_entries").insert(rows);
      if (error) throw error;
      toast.success(items.length > 1 ? "Combo adicionado!" : "Adicionado!");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function addEntry() {
    if (!selected) return;
    await saveAll([...combo, { food: selected, grams, qty: quantity, unit }]);
  }

  async function saveComboOnly() {
    if (combo.length === 0) return;
    await saveAll(combo);
  }

  const comboTotals = combo.reduce(
    (acc, it) => {
      const f = it.grams / 100;
      acc.kcal += it.food.calories_per_100g * f;
      acc.p += it.food.protein_g * f;
      acc.c += it.food.carbs_g * f;
      acc.g += it.food.fat_g * f;
      return acc;
    },
    { kcal: 0, p: 0, c: 0, g: 0 }
  );

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/app"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="font-semibold">Buscar alimento</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: arroz, frango, banana…" className="pl-9" />
        </div>

        {combo.length > 0 && (
          <Card className="p-4 space-y-3 shadow-card border-primary/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Combo ({combo.length} {combo.length === 1 ? "item" : "itens"})</p>
              <button onClick={() => setCombo([])} className="text-xs text-muted-foreground hover:text-destructive">Limpar</button>
            </div>
            <div className="space-y-1.5">
              {combo.map((it, i) => {
                const f = it.grams / 100;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{it.food.name} <span className="text-muted-foreground">· {it.grams.toFixed(0)}g</span></span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-primary font-medium">{Math.round(it.food.calories_per_100g * f)} kcal</span>
                      <button onClick={() => setCombo((c) => c.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted text-sm">
              <span>Total</span>
              <span className="font-bold text-primary">{Math.round(comboTotals.kcal)} kcal</span>
            </div>
            {!selected && (
              <Button onClick={saveComboOnly} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                {loading ? "Salvando…" : `Salvar combo (${combo.length})`}
              </Button>
            )}
          </Card>
        )}

        {selected ? (
          <Card className="p-5 space-y-4 shadow-card">
            <div>
              <p className="text-xs text-muted-foreground">Selecionado</p>
              <p className="font-semibold text-lg">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.calories_per_100g} kcal · {selected.protein_g}p · {selected.carbs_g}c · {selected.fat_g}g por 100g</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qty">Quantidade</Label>
                <Input id="qty" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Refeição</Label>
                <Select value={meal} onValueChange={(v) => setMeal(v as MealType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Café da manhã</SelectItem>
                    <SelectItem value="lunch">Almoço</SelectItem>
                    <SelectItem value="dinner">Jantar</SelectItem>
                    <SelectItem value="snack">Lanche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Equivale a {grams.toFixed(1)} g</p>
              <p className="text-2xl font-bold text-primary">{Math.round(selected.calories_per_100g * grams / 100)} kcal</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={addToCombo} variant="secondary" className="w-full">
                + Adicionar ao combo
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(null)} className="flex-1">Voltar</Button>
                <Button onClick={addEntry} disabled={loading} className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow">
                  {loading ? "Salvando…" : combo.length > 0 ? `Salvar (${combo.length + 1})` : "Adicionar"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {recent.length > 0 && query.trim() === "" && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Recentes</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setSelected(f); setQuantity(f.default_serving_g || 100); setUnit("g"); }}
                      className="px-3 py-1.5 rounded-full bg-muted text-sm hover:bg-primary/15 hover:text-primary transition-colors"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {results.map((f) => (
                <button key={f.id} onClick={() => { setSelected(f); setQuantity(f.default_serving_g || 100); setUnit("g"); }}
                  className="w-full p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.calories_per_100g} kcal / 100g</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum alimento encontrado.</p>
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setShowCustom((v) => !v)}>
              + Criar alimento personalizado
            </Button>
            {showCustom && <CustomFoodForm onCreated={(f) => { setSelected(f); setQuantity(f.default_serving_g || 100); setUnit("g"); setShowCustom(false); }} />}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function CustomFoodForm({ onCreated }: { onCreated: (f: Food) => void }) {
  const [name, setName] = useState("");
  const [cal, setCal] = useState(100);
  const [p, setP] = useState(0);
  const [c, setC] = useState(0);
  const [g, setG] = useState(0);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return toast.error("Dê um nome ao alimento");
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário");
      const { data, error } = await supabase.from("foods").insert({
        name: name.trim(), calories_per_100g: cal, protein_g: p, carbs_g: c, fat_g: g,
        is_custom: true, created_by: u.user.id,
      }).select().single();
      if (error) throw error;
      onCreated(data as Food);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4 space-y-3 shadow-card">
      <Input placeholder="Nome do alimento" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Kcal/100g</Label><Input type="number" value={cal} onChange={(e) => setCal(+e.target.value)} /></div>
        <div><Label className="text-xs">Proteína (g)</Label><Input type="number" value={p} onChange={(e) => setP(+e.target.value)} /></div>
        <div><Label className="text-xs">Carbo (g)</Label><Input type="number" value={c} onChange={(e) => setC(+e.target.value)} /></div>
        <div><Label className="text-xs">Gordura (g)</Label><Input type="number" value={g} onChange={(e) => setG(+e.target.value)} /></div>
      </div>
      <Button onClick={create} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
        {loading ? "Criando…" : "Criar e selecionar"}
      </Button>
    </Card>
  );
}

function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}
