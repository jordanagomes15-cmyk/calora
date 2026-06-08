import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzePhoto, type PhotoAnalysis } from "@/lib/photo.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const Route = createFileRoute("/_authenticated/photo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Foto da refeição — Calora" }] }),
  component: PhotoPage,
});

function PhotoPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [meal, setMeal] = useState<MealType>(guessMeal());
  const [saving, setSaving] = useState(false);
  const run = useServerFn(analyzePhoto);

  async function onFile(file: File) {
    const dataUrl = await fileToDataUrl(file, 1280);
    setPreview(dataUrl);
    setAnalysis(null);
    setAnalyzing(true);
    try {
      const result = await run({ data: { imageBase64: dataUrl } });
      setAnalysis(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(i: number, patch: Partial<PhotoAnalysis["items"][number]>) {
    if (!analysis) return;
    const items = analysis.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    setAnalysis({ ...analysis, items, total_calories: items.reduce((s, it) => s + Number(it.calories || 0), 0) });
  }

  function removeItem(i: number) {
    if (!analysis) return;
    const items = analysis.items.filter((_, idx) => idx !== i);
    setAnalysis({ ...analysis, items, total_calories: items.reduce((s, it) => s + Number(it.calories || 0), 0) });
  }

  async function saveAll() {
    if (!analysis || analysis.items.length === 0) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário");
      const { localDateStr } = await import("@/lib/date");
      const today = localDateStr();
      const rows = analysis.items.map((it) => ({
        user_id: u.user.id,
        food_name: it.name,
        meal_type: meal,
        grams: Number(it.estimated_grams) || 0,
        calories: Math.round(Number(it.calories) || 0),
        protein_g: Number(it.protein_g) || 0,
        carbs_g: Number(it.carbs_g) || 0,
        fat_g: Number(it.fat_g) || 0,
        eaten_on: today,
      }));
      const { error } = await supabase.from("meal_entries").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} item(ns) adicionado(s)`);
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/app"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="font-semibold">Foto da refeição</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        {!preview && (
          <Card className="p-8 text-center shadow-card bg-gradient-surface">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center shadow-glow">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="mt-4 font-bold text-lg">IA identifica sua refeição</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Tire ou envie uma foto do prato e a IA estima calorias e macros.</p>
            <Button onClick={() => fileRef.current?.click()} className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Camera className="w-4 h-4 mr-2" /> Tirar / enviar foto
            </Button>
          </Card>
        )}

        {preview && (
          <Card className="overflow-hidden shadow-card">
            <img src={preview} alt="Refeição" className="w-full aspect-video object-cover" />
            <div className="p-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPreview(null); setAnalysis(null); }} className="flex-1">Trocar foto</Button>
            </div>
          </Card>
        )}

        {analyzing && (
          <Card className="p-6 text-center shadow-card">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Analisando alimentos…</p>
          </Card>
        )}

        {analysis && !analyzing && (
          <>
            <Card className="p-5 shadow-card bg-gradient-surface">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total estimado</p>
              <p className="text-4xl font-bold text-primary">{analysis.total_calories} <span className="text-base text-muted-foreground font-normal">kcal</span></p>
              {analysis.notes && <p className="text-xs text-muted-foreground mt-2">{analysis.notes}</p>}
            </Card>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Itens identificados</p>
              {analysis.items.map((it, i) => (
                <Card key={i} className="p-3 space-y-2 shadow-card">
                  <div className="flex items-center gap-2">
                    <Input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="font-medium" />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <NumField label="g" value={it.estimated_grams} onChange={(v) => updateItem(i, { estimated_grams: v })} />
                    <NumField label="kcal" value={it.calories} onChange={(v) => updateItem(i, { calories: v })} />
                    <NumField label="P" value={it.protein_g} onChange={(v) => updateItem(i, { protein_g: v })} />
                    <NumField label="C" value={it.carbs_g} onChange={(v) => updateItem(i, { carbs_g: v })} />
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Refeição</p>
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

            <Button onClick={saveAll} disabled={saving || analysis.items.length === 0}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow h-12 text-base font-semibold">
              {saving ? "Salvando…" : `Adicionar ${analysis.items.length} item(ns)`}
            </Button>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 mt-0.5" />
    </label>
  );
}

function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

async function fileToDataUrl(file: File, maxSize = 1280): Promise<string> {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type || "image/jpeg" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
