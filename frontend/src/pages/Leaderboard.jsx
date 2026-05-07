import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import FighterAvatar from "@/components/FighterAvatar";
import { countryByCode, winRate } from "@/lib/game";
import { Trophy, Crown, Shield } from "lucide-react";

export default function Leaderboard() {
    const [scope, setScope] = useState("users");
    const [platform, setPlatform] = useState("ALL");
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            setLoading(true);
            try {
                const platParam = platform === "ALL" ? "" : `?platform=${platform}`;
                const [u, t] = await Promise.all([
                    api.get(`/leaderboard/users${platParam}`),
                    api.get(`/leaderboard/teams${platParam}`),
                ]);
                if (!alive) return;
                setUsers(u.data);
                setTeams(t.data);
            } finally { if (alive) setLoading(false); }
        };
        load();
        return () => { alive = false; };
    }, [platform]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-[0.5em] text-ki-gold font-display">Salón de los héroes</div>
                    <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-glow-gold mt-1">CLASIFICACIÓN</h1>
                </div>
                <div className="flex gap-3">
                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="w-40 bg-ki-surface border-white/10" data-testid="lb-platform-filter">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-ki-surface border-white/10">
                            <SelectItem value="ALL">Todas plataformas</SelectItem>
                            <SelectItem value="PC">PC</SelectItem>
                            <SelectItem value="PS5">PS5</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <Tabs value={scope} onValueChange={setScope}>
                <TabsList className="bg-ki-surface border border-white/5">
                    <TabsTrigger value="users" data-testid="lb-tab-users"><Crown className="w-4 h-4 mr-2" /> Individual</TabsTrigger>
                    <TabsTrigger value="teams" data-testid="lb-tab-teams"><Shield className="w-4 h-4 mr-2" /> Equipos</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="mt-4">
                    <div className="surface overflow-hidden">
                        <div className="grid grid-cols-12 px-4 py-3 text-[10px] uppercase tracking-widest font-display text-zinc-500 border-b border-white/5">
                            <div className="col-span-1">#</div>
                            <div className="col-span-4">Luchador</div>
                            <div className="col-span-2">Rango</div>
                            <div className="col-span-2 text-center hidden sm:block">Plataforma</div>
                            <div className="col-span-1 text-right">WR</div>
                            <div className="col-span-2 text-right">Puntos</div>
                        </div>
                        {loading ? (
                            <div className="py-10 text-center text-zinc-500 font-display tracking-widest">Cargando…</div>
                        ) : users.length === 0 ? (
                            <div className="py-10 text-center text-zinc-500">Aún no hay luchadores en este ranking.</div>
                        ) : users.map((u, i) => {
                            const c = countryByCode(u.country);
                            return (
                                <Link to={`/users/${u.id}`} key={u.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 hover:bg-ki-gold/5 transition" data-testid={`lb-row-${u.id}`}>
                                    <div className={`col-span-1 font-display text-xl ${i === 0 ? "text-glow-gold text-ki-gold" : i === 1 ? "text-zinc-200" : i === 2 ? "text-orange-400" : "text-zinc-500"}`}>
                                        {i + 1}
                                    </div>
                                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                                        <FighterAvatar user={u} size={40} ring={false} />
                                        <div className="min-w-0">
                                            <div className="font-heading font-bold truncate">{u.fighter_name}</div>
                                            <div className="text-[10px] text-zinc-500 font-display tracking-widest uppercase">
                                                {c ? `${c.flag} ${c.name}` : "—"}{u.team_name ? ` · ◈ ${u.team_name}` : ""}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2"><RankBadge points={u.points} /></div>
                                    <div className="col-span-2 text-center hidden sm:block">{u.platform && <PlatformBadge platform={u.platform} />}</div>
                                    <div className="col-span-1 text-right text-zinc-400 font-display">{winRate(u.total_wins, u.total_losses)}%</div>
                                    <div className="col-span-2 text-right font-display text-ki-gold text-lg">{u.points}</div>
                                </Link>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="teams" className="mt-4">
                    <div className="surface overflow-hidden">
                        <div className="grid grid-cols-12 px-4 py-3 text-[10px] uppercase tracking-widest font-display text-zinc-500 border-b border-white/5">
                            <div className="col-span-1">#</div>
                            <div className="col-span-6">Equipo</div>
                            <div className="col-span-2 text-center">Miembros</div>
                            <div className="col-span-3 text-right">Puntos totales</div>
                        </div>
                        {loading ? (
                            <div className="py-10 text-center text-zinc-500 font-display tracking-widest">Cargando…</div>
                        ) : teams.length === 0 ? (
                            <div className="py-10 text-center text-zinc-500">Sin equipos en este ranking.</div>
                        ) : teams.map((t, i) => (
                            <div key={t.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5">
                                <div className={`col-span-1 font-display text-xl ${i === 0 ? "text-glow-gold text-ki-gold" : "text-zinc-500"}`}>{i + 1}</div>
                                <div className="col-span-6 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 clip-hex bg-ki-surface border border-white/10 overflow-hidden flex items-center justify-center">
                                        {t.logo ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-zinc-600" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-heading font-bold truncate">{t.name}</div>
                                        <div className="text-[10px] text-zinc-500 font-display tracking-widest uppercase truncate">{t.description || "—"}</div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-center text-zinc-300 font-display">{t.member_count}</div>
                                <div className="col-span-3 text-right font-display text-ki-gold text-lg">{t.total_points}</div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
