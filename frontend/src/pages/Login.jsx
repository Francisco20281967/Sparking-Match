import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Swords } from "lucide-react";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            await login(name.trim(), pw);
            navigate("/");
        } catch (e) {
            setErr(formatErr(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-[#0b0518] to-[#05030A]" />
            <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-ki-gold/15 blur-[140px] rounded-full -z-10 animate-aura-pulse" />
            <div className="absolute -bottom-40 right-1/4 w-[420px] h-[420px] bg-ki-purple/20 blur-[140px] rounded-full -z-10" />

            <form
                onSubmit={onSubmit}
                className="w-full max-w-md glass p-8 sm:p-10 space-y-6 animate-fade-in relative"
                data-testid="login-form"
            >
                <div className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 clip-hex bg-gradient-to-br from-ki-gold via-orange-500 to-red-500 flex items-center justify-center">
                        <Swords className="w-6 h-6 text-black" />
                    </div>
                    <h1 className="font-display text-3xl tracking-[0.3em] text-glow-gold">SPARKING ZONE</h1>
                    <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 font-display">Inicia el combate</p>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Nombre de luchador</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Goku_SSJ"
                            className="bg-ki-surface border-white/10 focus-visible:ring-ki-gold focus-visible:border-ki-gold"
                            required
                            data-testid="login-fighter-name-input"
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Contraseña</Label>
                        <Input
                            type="password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            className="bg-ki-surface border-white/10 focus-visible:ring-ki-gold focus-visible:border-ki-gold"
                            required
                            data-testid="login-password-input"
                            autoComplete="current-password"
                        />
                    </div>
                </div>
                {err && (
                    <div className="text-sm text-red-400 border border-red-500/40 bg-red-500/5 px-3 py-2" data-testid="login-error">
                        {err}
                    </div>
                )}
                <Button type="submit" disabled={loading} className="btn-primary w-full py-6" data-testid="login-submit-btn">
                    {loading ? "Cargando ki..." : "Entrar al torneo"}
                </Button>
                <div className="text-center text-xs uppercase tracking-widest text-zinc-500 font-display">
                    ¿Aún no eres luchador?{" "}
                    <Link to="/register" className="text-ki-gold hover:text-ki-goldlight" data-testid="login-to-register">
                        Crea tu cuenta
                    </Link>
                </div>
            </form>
        </div>
    );
}
