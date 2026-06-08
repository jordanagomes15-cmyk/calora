import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000), // data URL or raw base64
});

export type FoodEstimate = {
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PhotoAnalysis = {
  items: FoodEstimate[];
  total_calories: number;
  notes?: string;
};

export const analyzePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<PhotoAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const imageUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um nutricionista. Analise a foto da refeição e identifique cada alimento visível, estimando o peso em gramas e os valores nutricionais. Seja realista com porções típicas brasileiras. Retorne SOMENTE via a função fornecida.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Identifique os alimentos nesta foto e estime calorias e macros." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "register_meal_estimate",
            description: "Registra os alimentos identificados e suas estimativas",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      estimated_grams: { type: "number" },
                      calories: { type: "number" },
                      protein_g: { type: "number" },
                      carbs_g: { type: "number" },
                      fat_g: { type: "number" },
                    },
                    required: ["name", "estimated_grams", "calories", "protein_g", "carbs_g", "fat_g"],
                    additionalProperties: false,
                  },
                },
                notes: { type: "string" },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "register_meal_estimate" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error("Falha ao analisar a foto.");
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("Resposta inesperada da IA.");
    const parsed = JSON.parse(call.function.arguments) as {
      items: FoodEstimate[];
      notes?: string;
    };
    const total = parsed.items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    return { items: parsed.items, total_calories: Math.round(total), notes: parsed.notes };
  });
