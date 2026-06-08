import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Calora" },
      { name: "description", content: "Acesse sua conta no Calora, seu contador de calorias." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Confira seu e-mail para confirmar.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha inválidos" : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-primary shadow-glow">
            <Flame className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Calora</h1>
          <p className="text-muted-foreground text-sm">Conte calorias. Atinja sua meta. Sem complicação.</p>
        </div>

        <Card className="p-6 shadow-card">
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95">
              {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/app`,
                  },
                });
                if (error) throw error;
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro no login com Google");
                setLoading(false);
              }
            }}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        </Card>
      </div>
    </div>
  );
}
