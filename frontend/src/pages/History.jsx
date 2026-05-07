import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import FighterAvatar from "@/components/FighterAvatar";
import { Trophy } from "lucide-react";

export default function History() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try { const { data } = await api.get("/history"); if (alive) setItems(data); }
            finally { if (alive) setLoading(false); }
        };
        load();
        return () => { alive = false; };
    }, []);

    return (
        <div className="space-y-6">
            <header>
                <div className="text-xs uppercase tracking-[0.5em] text-ki-blue font-display">Crónicas de combate</div>
                <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-glow-cyan mt-1">HISTORIAL</h1>
            </header>

            {loading ? (
                <div className="text-center text-zinc-500 py-10 font-display tracking-widest uppercase">Cargando…</div>
            ) : items.length === 0 ? (
                <div className="text-center surface p-12">
                    <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <div className="font-display tracking-widest text-zinc-400">Aún no has librado batalla. Hora de probarlo.</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((m) => (
                        <Link
                            to={m.opponent ? `/users/${m.opponent.id}` : "#"}
                            key={m.id}
                            className="grid grid-cols-12 items-center gap-3 surface px-4 py-3"
                            data-testid={`history-row-${m.id}`}
                        >
                            <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0">
                                <FighterAvatar user={m.opponent} size={42} ring={false} />
                                <div className="min-w-0">
                                    <div className="font-heading font-bold truncate">{m.opponent?.fighter_name || "Desconocido"}</div>
                                    <div className="text-[10px] text-zinc-500 font-display tracking-widest uppercase">
                                        Peleas: {m.times_fought}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-3 sm:col-span-3 text-center font-display text-2xl text-ki-gold">
                                {m.my_score} <span className="text-zinc-600">vs</span> {m.opp_score}
                            </div>
                            <div className="col-span-3 sm:col-span-2 text-center text-xs">
                                <span className={`font-display tracking-widest uppercase border px-2 py-0.5 ${
                                    m.result === "win" ? "border-emerald-500/60 text-emerald-300" : m.result === "loss" ? "border-red-500/60 text-red-300" : "border-zinc-500/60 text-zinc-300"
                                }`}>
                                    {m.result === "win" ? "Victoria" : m.result === "loss" ? "Derrota" : "Empate"}
                                </span>
                            </div>
                            <div className="hidden sm:block col-span-2 text-right text-xs text-zinc-500 font-display tracking-widest uppercase">
                                {m.finished_at ? new Date(m.finished_at).toLocaleDateString() : "—"}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
