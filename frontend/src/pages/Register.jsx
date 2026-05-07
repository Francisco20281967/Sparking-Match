import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Monitor, Gamepad2, Swords } from "lucide-react";

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [platform, setPlatform] = useState("PC");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        if (pw !== pw2) {
            setErr("Las contraseñas no coinciden");
            return;
        }
        if (pw.length < 4) {
            setErr("La contraseña debe tener al menos 4 caracteres");
            return;
        }
        setLoading(true);
        try {
            await register(name.trim(), pw, platform);
            navigate("/");
        } catch (e) {
            setErr(formatErr(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-[#0b0518] to-[#05030A]" />
            <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] bg-ki-purple/20 blur-[140px] rounded-full -z-10 animate-aura-pulse" />
            <div className="absolute -bottom-40 left-1/4 w-[420px] h-[420px] bg-ki-gold/15 blur-[140px] rounded-full -z-10" />

            <form
                onSubmit={onSubmit}
                className="w-full max-w-md glass p-8 sm:p-10 space-y-6 animate-fade-in"
                data-testid="register-form"
            >
                <div className="text-center space-y-3">
                    <div className="mx-auto w-14 h-14 clip-hex bg-gradient-to-br from-ki-purple via-blue-500 to-ki-blue flex items-center justify-center">
                        <Swords className="w-6 h-6 text-black" />
                    </div>
                    <h1 className="font-display text-3xl tracking-[0.3em] text-glow-violet">FORJA TU LEYENDA</h1>
                    <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 font-display">Crea tu cuenta</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Nombre de luchador</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Vegeta_Ouji"
                            className="bg-ki-surface border-white/10 focus-visible:ring-ki-gold focus-visible:border-ki-gold"
                            required
                            minLength={3}
                            maxLength={20}
                            data-testid="register-fighter-name-input"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Contraseña</Label>
                            <Input
                                type="password"
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                                className="bg-ki-surface border-white/10 focus-visible:ring-ki-gold focus-visible:border-ki-gold"
                                required
                                minLength={4}
                                data-testid="register-password-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Repite</Label>
                            <Input
                                type="password"
                                value={pw2}
                                onChange={(e) => setPw2(e.target.value)}
                                className="bg-ki-surface border-white/10 focus-visible:ring-ki-gold focus-visible:border-ki-gold"
                                required
                                minLength={4}
                                data-testid="register-password2-input"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-display">Plataforma</Label>
                        <RadioGroup value={platform} onValueChange={setPlatform} className="grid grid-cols-2 gap-3" data-testid="register-platform-group">
                            <PlatformOption value="PC" active={platform === "PC"} icon={Monitor} label="PC" />
                            <PlatformOption value="PS5" active={platform === "PS5"} icon={Gamepad2} label="PS5" />
                        </RadioGroup>
                    </div>
                </div>
                {err && (
                    <div className="text-sm text-red-400 border border-red-500/40 bg-red-500/5 px-3 py-2" data-testid="register-error">
                        {err}
                    </div>
                )}
                <Button type="submit" disabled={loading} className="btn-primary w-full py-6" data-testid="register-submit-btn">
                    {loading ? "Despertando ki..." : "Comenzar el viaje"}
                </Button>
                <div className="text-center text-xs uppercase tracking-widest text-zinc-500 font-display">
                    ¿Ya eres luchador?{" "}
                    <Link to="/login" className="text-ki-gold hover:text-ki-goldlight" data-testid="register-to-login">
                        Inicia sesión
                    </Link>
                </div>
            </form>
        </div>
    );
}

function PlatformOption({ value, active, icon: Icon, label }) {
    return (
        <label
            data-testid={`register-platform-${value}`}
            className={`relative cursor-pointer flex flex-col items-center gap-2 py-4 border rounded-sm transition-all ${
                active ? "border-ki-gold bg-ki-gold/10 shadow-[0_0_18px_rgba(251,191,36,0.35)]" : "border-white/10 hover:border-white/30"
            }`}
        >
            <RadioGroupItem value={value} className="sr-only" />
            <Icon className={`w-7 h-7 ${active ? "text-ki-gold" : "text-zinc-400"}`} />
            <span className={`font-display tracking-widest text-sm ${active ? "text-ki-gold" : "text-zinc-300"}`}>{label}</span>
        </label>
    );
}
