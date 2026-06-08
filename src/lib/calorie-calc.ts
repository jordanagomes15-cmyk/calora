// Body metrics → TDEE → daily target with smart goal direction & safety caps.

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalDirection = "lose" | "maintain" | "gain";

const ACTIVITY: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Mifflin–St Jeor
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function calcTDEE(sex: Sex, weightKg: number, heightCm: number, age: number, activity: Activity) {
  return calcBMR(sex, weightKg, heightCm, age) * ACTIVITY[activity];
}

export function detectGoal(weightKg: number, targetWeightKg: number): GoalDirection {
  const diff = targetWeightKg - weightKg;
  if (Math.abs(diff) < 0.5) return "maintain";
  return diff < 0 ? "lose" : "gain";
}

// 1 kg de gordura/tecido ≈ 7700 kcal. Pace em kg/semana → kcal/dia
export function calcDailyTarget(opts: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: Activity;
  goalPaceKgPerWeek: number; // magnitude (sempre positivo)
  targetWeightKg?: number; // usado para detectar direção
}) {
  const tdee = calcTDEE(opts.sex, opts.weightKg, opts.heightCm, opts.age, opts.activity);
  const direction = opts.targetWeightKg !== undefined
    ? detectGoal(opts.weightKg, opts.targetWeightKg)
    : (opts.goalPaceKgPerWeek > 0 ? "lose" : "maintain");

  if (direction === "maintain") return Math.round(tdee);

  const pace = Math.abs(opts.goalPaceKgPerWeek);
  const rawAdjust = (pace * 7700) / 7;

  if (direction === "lose") {
    // Limita déficit a 25% do TDEE para sustentabilidade
    const maxDeficit = tdee * 0.25;
    const deficit = Math.min(rawAdjust, maxDeficit);
    const target = Math.round(tdee - deficit);
    const floor = opts.sex === "male" ? 1500 : 1200;
    return Math.max(target, floor);
  }

  // gain: limita superávit a 500 kcal/dia para minimizar ganho de gordura
  const surplus = Math.min(rawAdjust, 500);
  return Math.round(tdee + surplus);
}

export function calcMacros(targetKcal: number, weightKg: number) {
  // Proteína: 1.8 g/kg • Gordura: 25% kcal • Carbo: restante
  const proteinG = Math.round(1.8 * weightKg);
  const fatG = Math.round((targetKcal * 0.25) / 9);
  const carbsKcal = targetKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(carbsKcal / 4));
  return { proteinG, fatG, carbsG };
}

export function bmi(weightKg: number, heightCm: number) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Sedentário (pouco ou nada)",
  light: "Leve (1-3x/semana)",
  moderate: "Moderado (3-5x/semana)",
  active: "Ativo (6-7x/semana)",
  very_active: "Muito ativo (2x/dia)",
};

export const GOAL_LABELS: Record<GoalDirection, string> = {
  lose: "Perder peso",
  maintain: "Manter peso",
  gain: "Ganhar peso",
};
