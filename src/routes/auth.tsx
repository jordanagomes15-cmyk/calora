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
    let isMounted = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setMode("signin");

      const keepOnLogin = async () => {
        await supabase.auth.signOut();
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await supabase.auth.signOut();
        if (isMounted) toast.success("E-mail confirmado! Agora entre com sua senha.");
      };

      keepOnLogin();
      return () => {
        isMounted = false;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) navigate({ to: "/app", replace: true });
    });

    return () => {
      isMounted = false;
    };
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
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Enviamos a confirmação para seu e-mail.");
        setMode("signin");
        setPassword("");
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
            {mode === "signup" && (
              <p className="text-center text-xs leading-5 text-muted-foreground">
                Depois do cadastro, enviaremos um link de confirmação para seu e-mail.
              </p>
            )}
          </form>

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
