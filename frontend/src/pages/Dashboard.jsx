import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMatchmaking } from "@/contexts/MatchmakingContext";
import { api } from "@/lib/api";
import { multiplierFor, rankFor, rankProgress, winRate } from "@/lib/game";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import FighterAvatar from "@/components/FighterAvatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Swords, Flame, Trophy, Zap, Target, Users, ShieldAlert } from "lucide-react";

export default function Dashboard() {
    const { user } = useAuth();
    const { connected, joinQueue, leaveQueue, state } = useMatchmaking();
    const [stats, setStats] = useState({ online: 0, queue_pc: 0, queue_ps5: 0 });
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const [s, h] = await Promise.all([
                    api.get("/stats"),
                    api.get("/history"),
                ]);
                if (!active) return;
                setStats(s.data);
                setRecent(h.data.slice(0, 3));
            } catch {}
        };
        load();
        const t = setInterval(load, 5000);
        return () => { active = false; clearInterval(t); };
    }, [user?.points]);

    const r = rankFor(user?.points || 0);
    const rp = rankProgress(user?.points || 0);
    const mult = multiplierFor(user?.win_streak || 0);
    const wr = winRate(user?.total_wins, user?.total_losses);
    const queueing = state.status === "queued" || state.status === "match_found";

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Identity */}
                <div className="lg:col-span-2 surface p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full" style={{ background: r.color, opacity: 0.08, filter: "blur(60px)" }} />
                    <div className="flex items-start gap-5 relative">
                        <FighterAvatar user={user} size={92} />
                        <div className="flex-1 min-w-0">
                            <div className="font-heading font-bold text-2xl truncate">{user?.fighter_name}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <RankBadge points={user?.points || 0} />
                                {user?.platform && <PlatformBadge platform={user.platform} />}
                                {user?.team_name && (
                                    <span className="text-xs font-display tracking-widest uppercase border border-white/15 px-2 py-0.5 text-zinc-300">
                                        ◈ {user.team_name}
                                    </span>
                                )}
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between text-[10px] uppercase tracking-widest font-display text-zinc-500">
                                    <span>{r.name}</span>
                                    <span>
                                        {rp.next ? `${rp.remaining} pts hasta ascender` : "Rango máximo"}
                                    </span>
                                </div>
                                <div className="mt-1 h-2 bg-ki-surface border border-white/5 overflow-hidden">
                                    <div className="h-full" style={{ width: `${rp.percent}%`, background: r.color, boxShadow: `0 0 12px ${r.glow}` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <Stat label="Puntos" value={user?.points || 0} accent="text-ki-gold" />
                        <Stat label="Racha" value={`x${mult}`} accent="text-orange-300" />
                        <Stat label="Win rate" value={`${wr}%`} accent="text-emerald-300" />
                    </div>
                </div>

                {/* Center: Matchmaking */}
                <div className="lg:col-span-3 surface p-6 sm:p-10 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                    <div className="absolute inset-0 -z-0 opacity-30" style={{
                        background: "radial-gradient(circle at 50% 50%, rgba(251,191,36,0.18), transparent 60%)"
                    }} />
                    <div className="text-center space-y-2 z-10">
                        <div className="font-display text-xs tracking-[0.5em] text-zinc-500 uppercase">Sistema de combate</div>
                        <h1 className="font-display text-4xl sm:text-5xl tracking-[0.2em] text-glow-gold">QUE COMIENCE LA PELEA</h1>
                        <p className="text-zinc-400 max-w-md mx-auto">
                            Pulsa el botón y conéctate con otro guerrero al instante. Mejor de 3 partidas. Cada victoria multiplica tu poder.
                        </p>
                    </div>
                    <button
                        onClick={queueing ? leaveQueue : joinQueue}
                        disabled={!connected}
                        data-testid="matchmaking-button"
                        className={`aura-ring relative w-56 h-56 sm:w-64 sm:h-64 rounded-full flex items-center justify-center font-display tracking-[0.3em] text-2xl sm:text-3xl transition-all ${
                            queueing ? "bg-red-500/20 text-red-200 border-2 border-red-500" : "bg-gradient-to-br from-ki-gold via-orange-500 to-red-500 text-black"
                        } ${queueing ? "animate-pulse" : "animate-aura-pulse"}`}
                    >
                        <Swords className="absolute opacity-10 w-40 h-40" />
                        <span className="relative z-10">{queueing ? "CANCELAR" : "MATCHMAKING"}</span>
                    </button>
                    <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-widest font-display text-zinc-400 z-10">
                        <span className="flex items-center gap-2"><Users className="w-3 h-3 text-emerald-400" /> {stats.online} en línea</span>
                        <span className="flex items-center gap-2"><Target className="w-3 h-3 text-cyan-400" /> {stats.queue_pc} en cola PC</span>
                        <span className="flex items-center gap-2"><Target className="w-3 h-3 text-blue-400" /> {stats.queue_ps5} en cola PS5</span>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <InfoCard icon={Flame} title="Racha actual" value={user?.win_streak || 0} subtitle={`Mejor racha: ${user?.best_streak || 0}`} color="text-orange-400" />
                <InfoCard icon={Trophy} title="Sets ganados" value={`${user?.sets_won || 0}`} subtitle={`Sets perdidos: ${user?.sets_lost || 0}`} color="text-ki-gold" />
                <InfoCard icon={Zap} title="Partidas ganadas" value={user?.total_wins || 0} subtitle={`Perdidas: ${user?.total_losses || 0}`} color="text-emerald-400" />
                <InfoCard icon={ShieldAlert} title="Multiplicador" value={`x${mult}`} subtitle={mult >= 10 ? "MÁXIMO PODER" : "Sigue ganando"} color="text-ki-purple" />
            </section>

            <section className="surface p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl tracking-[0.25em] text-glow-gold">ÚLTIMOS COMBATES</h2>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 font-display">Mejor de 3</div>
                </div>
                {recent.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-sm font-body">Aún no has combatido. Lanza tu primer Kamehameha.</div>
                ) : (
                    <div className="space-y-2">
                        {recent.map((m) => (
                            <div key={m.id} className="grid grid-cols-12 items-center gap-3 border border-white/5 px-4 py-3 bg-ki-void/40 hover:border-ki-gold/40 transition">
                                <div className="col-span-7 flex items-center gap-3 min-w-0">
                                    <FighterAvatar user={m.opponent} size={38} ring={false} />
                                    <div className="min-w-0">
                                        <div className="font-heading font-bold truncate">{m.opponent?.fighter_name || "Desconocido"}</div>
                                        <div className="text-xs text-zinc-500 font-display tracking-widest uppercase">peleas: {m.times_fought}</div>
                                    </div>
                                </div>
                                <div className="col-span-3 text-center font-display text-2xl text-ki-gold">
                                    {m.my_score} <span className="text-zinc-600">vs</span> {m.opp_score}
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className={`text-xs font-display tracking-widest uppercase border px-2 py-0.5 ${
                                        m.result === "win" ? "border-emerald-500/60 text-emerald-300" : m.result === "loss" ? "border-red-500/60 text-red-300" : "border-zinc-500/60 text-zinc-300"
                                    }`}>
                                        {m.result === "win" ? "Victoria" : m.result === "loss" ? "Derrota" : "Empate"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function Stat({ label, value, accent }) {
    return (
        <div className="border border-white/5 bg-ki-void/40 px-3 py-2 text-center">
            <div className={`font-display text-2xl ${accent}`}>{value}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-display">{label}</div>
        </div>
    );
}

function InfoCard({ icon: Icon, title, value, subtitle, color }) {
    return (
        <div className="surface p-5">
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="font-display text-xs tracking-widest uppercase text-zinc-400">{title}</span>
            </div>
            <div className={`font-display text-3xl mt-3 ${color}`}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1 font-body">{subtitle}</div>
        </div>
    );
}
