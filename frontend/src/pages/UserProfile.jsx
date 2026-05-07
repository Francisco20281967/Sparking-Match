import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { countryByCode, winRate, multiplierFor } from "@/lib/game";
import FighterAvatar from "@/components/FighterAvatar";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Heart, Target, ArrowLeft } from "lucide-react";

export default function UserProfile() {
    const { id } = useParams();
    const { user: me } = useAuth();
    const [u, setU] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const { data } = await api.get(`/users/${id}`);
                if (alive) setU(data);
            } catch (e) { toast.error(formatErr(e)); }
            finally { if (alive) setLoading(false); }
        };
        load();
        return () => { alive = false; };
    }, [id]);

    const addRel = async (type) => {
        try {
            await api.post("/friends", { user_id: id, type });
            toast.success(type === "friend" ? "Añadido a amigos" : "Añadido a rivales");
        } catch (e) { toast.error(formatErr(e)); }
    };

    if (loading) return <div className="text-center text-zinc-500 py-12 font-display tracking-widest uppercase">Cargando…</div>;
    if (!u) return <div className="text-center text-zinc-500 py-12">Luchador no encontrado</div>;
    const c = countryByCode(u.country);
    const wr = winRate(u.total_wins, u.total_losses);
    const isMe = me?.id === u.id;

    return (
        <div className="space-y-6">
            <Link to="/friends" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400 hover:text-ki-gold font-display">
                <ArrowLeft className="w-3 h-3" /> Volver
            </Link>
            <header className="surface p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <FighterAvatar user={u} size={120} />
                <div className="flex-1 space-y-3">
                    <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-glow-gold">{u.fighter_name}</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <RankBadge points={u.points} size="lg" />
                        {u.platform && <PlatformBadge platform={u.platform} size="lg" />}
                        {c && <span className="text-sm border border-white/15 px-2 py-1 font-display uppercase tracking-widest">{c.flag} {c.name}</span>}
                        {u.team_name && <span className="text-sm border border-white/15 px-2 py-1 font-display uppercase tracking-widest">◈ {u.team_name}</span>}
                    </div>
                    {!isMe && (
                        <div className="flex gap-2 pt-2">
                            <Button onClick={() => addRel("friend")} className="btn-ghost-violet" data-testid="user-add-friend">
                                <Heart className="w-4 h-4 mr-2" /> Añadir amigo
                            </Button>
                            <Button onClick={() => addRel("rival")} className="btn-danger" data-testid="user-add-rival">
                                <Target className="w-4 h-4 mr-2" /> Marcar como rival
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat title="Puntos" value={u.points} accent="text-ki-gold" />
                <Stat title="Win rate" value={`${wr}%`} accent="text-emerald-400" />
                <Stat title="Sets ganados" value={u.sets_won} accent="text-cyan-400" />
                <Stat title="Mejor racha" value={u.best_streak} accent="text-orange-400" />
                <Stat title="Partidas G" value={u.total_wins} accent="text-emerald-300" />
                <Stat title="Partidas P" value={u.total_losses} accent="text-red-300" />
                <Stat title="Multiplicador" value={`x${multiplierFor(u.win_streak)}`} accent="text-ki-purple" />
                <Stat title="Sets perdidos" value={u.sets_lost} accent="text-zinc-300" />
            </div>
        </div>
    );
}

function Stat({ title, value, accent }) {
    return (
        <div className="surface p-5 text-center">
            <div className={`font-display text-3xl ${accent}`}>{value}</div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-display mt-1">{title}</div>
        </div>
    );
}
