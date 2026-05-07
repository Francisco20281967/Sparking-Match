import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import FighterAvatar from "@/components/FighterAvatar";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Heart, Search, X, Target, ArrowRight, UserPlus } from "lucide-react";
import { countryByCode, winRate } from "@/lib/game";

export default function Friends() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { const { data } = await api.get("/friends"); setList(data); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (q.trim().length < 2) { setResults([]); return; }
            setSearching(true);
            try { const { data } = await api.get(`/users?q=${encodeURIComponent(q.trim())}`); setResults(data); }
            catch {} finally { setSearching(false); }
        }, 280);
        return () => clearTimeout(t);
    }, [q]);

    const add = async (id, type) => {
        try {
            await api.post("/friends", { user_id: id, type });
            toast.success(type === "friend" ? "Añadido a amigos" : "Marcado como rival");
            await load();
        } catch (e) { toast.error(formatErr(e)); }
    };

    const remove = async (id) => {
        try { await api.delete(`/friends/${id}`); toast.success("Eliminado"); await load(); }
        catch (e) { toast.error(formatErr(e)); }
    };

    const friends = list.filter((u) => u.relation_type === "friend");
    const rivals = list.filter((u) => u.relation_type === "rival");

    return (
        <div className="space-y-6">
            <header>
                <div className="text-xs uppercase tracking-[0.5em] text-emerald-400 font-display">Conexiones de batalla</div>
                <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-glow-gold mt-1">AMIGOS Y RIVALES</h1>
            </header>

            <div className="surface p-5 space-y-3">
                <div className="text-xs uppercase tracking-widest font-display text-zinc-400 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Buscar luchadores
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Escribe un nombre…"
                        className="bg-ki-void border-white/10 pl-10"
                        data-testid="friends-search-input"
                    />
                </div>
                {q.trim().length >= 2 && (
                    <div className="space-y-2">
                        {searching && <div className="text-xs text-zinc-500 font-display tracking-widest">Buscando…</div>}
                        {!searching && results.length === 0 && <div className="text-xs text-zinc-500">Sin resultados</div>}
                        {results.map((u) => (
                            <div key={u.id} className="flex items-center gap-3 border border-white/5 px-3 py-2 bg-ki-void/40">
                                <FighterAvatar user={u} size={36} ring={false} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-heading font-bold truncate">{u.fighter_name}</div>
                                    <div className="flex gap-2 items-center mt-0.5">
                                        <RankBadge points={u.points} size="sm" />
                                        {u.platform && <PlatformBadge platform={u.platform} size="sm" />}
                                    </div>
                                </div>
                                <Button onClick={() => add(u.id, "friend")} className="btn-ghost-violet text-xs px-2 py-1" data-testid={`friends-add-friend-${u.id}`}>
                                    <Heart className="w-3 h-3" />
                                </Button>
                                <Button onClick={() => add(u.id, "rival")} className="btn-danger text-xs px-2 py-1" data-testid={`friends-add-rival-${u.id}`}>
                                    <Target className="w-3 h-3" />
                                </Button>
                                <Link to={`/users/${u.id}`} className="text-xs text-zinc-400 hover:text-ki-gold font-display tracking-widest uppercase flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Tabs defaultValue="friends">
                <TabsList className="bg-ki-surface border border-white/5">
                    <TabsTrigger value="friends" data-testid="friends-tab-friends"><Heart className="w-4 h-4 mr-2" /> Amigos ({friends.length})</TabsTrigger>
                    <TabsTrigger value="rivals" data-testid="friends-tab-rivals"><Target className="w-4 h-4 mr-2" /> Rivales ({rivals.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="friends" className="mt-4">
                    {loading ? <Loading /> : friends.length === 0 ? <Empty text="Aún no tienes amigos. Búscalos arriba." /> : <Grid items={friends} onRemove={remove} />}
                </TabsContent>
                <TabsContent value="rivals" className="mt-4">
                    {loading ? <Loading /> : rivals.length === 0 ? <Empty text="Sin rivales marcados." /> : <Grid items={rivals} onRemove={remove} />}
                </TabsContent>
            </Tabs>
        </div>
    );
}

const Loading = () => <div className="text-center text-zinc-500 py-10 font-display tracking-widest uppercase">Cargando…</div>;
const Empty = ({ text }) => <div className="text-center surface p-10 text-zinc-500">{text}</div>;

function Grid({ items, onRemove }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((u) => {
                const c = countryByCode(u.country);
                const wr = winRate(u.total_wins, u.total_losses);
                return (
                    <Link
                        to={`/users/${u.id}`}
                        key={u.id}
                        className="surface p-4 flex items-center gap-4"
                        data-testid={`friends-row-${u.id}`}
                    >
                        <FighterAvatar user={u} size={56} />
                        <div className="flex-1 min-w-0">
                            <div className="font-heading font-bold truncate">{u.fighter_name}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                <RankBadge points={u.points} size="sm" />
                                {u.platform && <PlatformBadge platform={u.platform} size="sm" />}
                                {c && <span className="text-[10px] font-display uppercase tracking-widest border border-white/10 px-1.5 py-0.5">{c.flag} {c.code}</span>}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 font-body">WR {wr}% · {u.points} pts</div>
                        </div>
                        <Button
                            onClick={(e) => { e.preventDefault(); onRemove(u.id); }}
                            className="btn-danger px-2 py-1"
                            data-testid={`friends-remove-${u.id}`}
                            title="Quitar"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </Link>
                );
            })}
        </div>
    );
}
