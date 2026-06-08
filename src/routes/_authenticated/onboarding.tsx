import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { calcDailyTarget, calcMacros, calcTDEE, detectGoal, bmi, ACTIVITY_LABELS, GOAL_LABELS, type Sex, type Activity } from "@/lib/calorie-calc";
import { Flame, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurar meta — Calora" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState(30);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(75);
  const [targetWeightKg, setTargetWeightKg] = useState(70);
  const [activity, setActivity] = useState<Activity>("light");
  const [pace, setPace] = useState(0.5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // se já onboardou, pula
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("onboarded").eq("id", u.user.id).maybeSingle();
      if (p?.onboarded) navigate({ to: "/app", replace: true });
    })();
  }, [navigate]);

  const goal = detectGoal(weightKg, targetWeightKg);
  const effectivePace = goal === "maintain" ? 0 : pace;
  const target = calcDailyTarget({ sex, weightKg, heightCm, age, activity, goalPaceKgPerWeek: effectivePace, targetWeightKg });
  const tdee = Math.round(calcTDEE(sex, weightKg, heightCm, age, activity));
  const macros = calcMacros(target, weightKg);
  const userBmi = bmi(weightKg, heightCm);
  const weeksToGoal = effectivePace > 0 ? Math.ceil(Math.abs(weightKg - targetWeightKg) / effectivePace) : 0;
  const bmiWarning = userBmi < 18.5 && goal === "lose" ? "Seu IMC já está abaixo do saudável — considere manter ou ganhar."
    : userBmi > 30 && goal === "gain" ? "Seu IMC está alto — considere manter ou perder."
    : null;

  async function finish() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário");
      const { error } = await supabase.from("profiles").update({
        sex, age, height_cm: heightCm, weight_kg: weightKg,
        target_weight_kg: targetWeightKg, activity_level: activity,
        goal_pace_kg_per_week: pace, daily_calorie_target: target,
        onboarded: true,
      }).eq("id", u.user.id);
      if (error) throw error;
      toast.success(`Meta definida: ${target} kcal/dia`);
      navigate({ to: "/app", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Sobre você",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Sexo biológico</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as Sex[]).map((s) => (
                <button key={s} type="button" onClick={() => setSex(s)}
                  className={`p-4 rounded-xl border-2 transition-all ${sex === s ? "border-primary bg-primary/10" : "border-border bg-muted"}`}>
                  {s === "male" ? "Masculino" : "Feminino"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Idade: <span className="text-primary font-semibold">{age} anos</span></Label>
            <Slider value={[age]} onValueChange={([v]) => setAge(v)} min={14} max={90} step={1} />
          </div>
          <div className="space-y-2">
            <Label>Altura: <span className="text-primary font-semibold">{heightCm} cm</span></Label>
            <Slider value={[heightCm]} onValueChange={([v]) => setHeightCm(v)} min={120} max={220} step={1} />
          </div>
        </div>
      ),
    },
    {
      title: "Peso e meta",
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="w">Peso atual (kg)</Label>
              <Input id="w" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tw">Peso desejado (kg)</Label>
              <Input id="tw" type="number" step="0.1" value={targetWeightKg} onChange={(e) => setTargetWeightKg(Number(e.target.value))} />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
            <span className="text-muted-foreground">Objetivo detectado: </span>
            <span className="font-semibold text-primary">{GOAL_LABELS[goal]}</span>
          </div>
          {goal !== "maintain" && (
            <div className="space-y-2">
              <Label>Ritmo: <span className="text-primary font-semibold">{pace.toFixed(2)} kg/semana</span></Label>
              <Slider value={[pace]} onValueChange={([v]) => setPace(v)} min={0.1} max={1} step={0.05} />
              <p className="text-xs text-muted-foreground">
                {pace <= 0.25 ? "Suave e sustentável" : pace <= 0.5 ? "Recomendado" : pace <= 0.75 ? "Acelerado" : "Agressivo (difícil manter)"}
              </p>
            </div>
          )}
          {bmiWarning && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{bmiWarning}</p>
          )}
        </div>
      ),
    },
    {
      title: "Nível de atividade",
      content: (
        <div className="space-y-2">
          <Label>Quão ativo você é?</Label>
          <Select value={activity} onValueChange={(v) => setActivity(v as Activity)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      title: "Sua meta diária",
      content: (
        <div className="space-y-4">
          <div className="text-center p-6 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <p className="text-sm uppercase tracking-wider opacity-80">Meta diária</p>
            <p className="text-5xl font-bold mt-1">{target}</p>
            <p className="text-sm opacity-80 mt-1">kcal por dia</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Proteína</p>
              <p className="font-semibold">{macros.proteinG}g</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Carbo</p>
              <p className="font-semibold">{macros.carbsG}g</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Gordura</p>
              <p className="font-semibold">{macros.fatG}g</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">Gasto estimado</p>
              <p className="font-semibold text-lg">{tdee} kcal</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">IMC atual</p>
              <p className="font-semibold text-lg">{userBmi.toFixed(1)}</p>
            </div>
            {weeksToGoal > 0 && (
              <div className="p-3 rounded-lg bg-muted col-span-2">
                <p className="text-muted-foreground">Previsão para {GOAL_LABELS[goal].toLowerCase()}</p>
                <p className="font-semibold text-lg">~{weeksToGoal} semanas</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-primary shadow-glow">
            <Flame className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Passo {step + 1} de {steps.length}</p>
          <h1 className="text-2xl font-bold">{current.title}</h1>
        </div>

        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        <Card className="p-6 shadow-card">{current.content}</Card>

        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          )}
          {!isLast ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow">
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow">
              {saving ? "Salvando…" : "Começar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
