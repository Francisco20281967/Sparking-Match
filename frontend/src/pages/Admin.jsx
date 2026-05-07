import { useEffect, useState, useCallback } from "react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import FighterAvatar from "@/components/FighterAvatar";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import { COUNTRIES } from "@/lib/game";
import { toast } from "sonner";
import { Search, Edit, Trash2, Ban, ShieldCheck, ShieldOff, Users, Shield, Activity, RefreshCw, Crown, AlertTriangle } from "lucide-react";

export default function Admin() {
    const { user } = useAuth();
    if (!user || user.role !== "admin") return <Navigate to="/" replace />;
    return (
        <div className="space-y-6">
            <header>
                <div className="text-xs uppercase tracking-[0.5em] text-ki-red font-display flex items-center gap-2">
                    <Crown className="w-4 h-4" /> Panel de control
                </div>
                <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-glow-gold mt-1">ADMINISTRACIÓN</h1>
                <p className="text-zinc-400 mt-2 text-sm font-body">Gestiona luchadores, puntos, baneos y equipos. Usa con responsabilidad.</p>
            </header>
            <StatsBar />
            <Tabs defaultValue="users">
                <TabsList className="bg-ki-surface border border-white/5">
                    <TabsTrigger value="users" data-testid="admin-tab-users"><Users className="w-4 h-4 mr-2" /> Usuarios</TabsTrigger>
                    <TabsTrigger value="teams" data-testid="admin-tab-teams"><Shield className="w-4 h-4 mr-2" /> Equipos</TabsTrigger>
                </TabsList>
                <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
                <TabsContent value="teams" className="mt-4"><TeamsPanel /></TabsContent>
            </Tabs>
        </div>
    );
}

function StatsBar() {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        const load = async () => {
            try { const { data } = await api.get("/admin/stats"); setStats(data); } catch {}
        };
        load();
        const t = setInterval(load, 6000);
        return () => clearInterval(t);
    }, []);
    if (!stats) return null;
    const items = [
        { label: "Usuarios", value: stats.total_users, c: "text-ki-gold" },
        { label: "Equipos", value: stats.total_teams, c: "text-cyan-300" },
        { label: "Combates", value: stats.total_matches, c: "text-emerald-300" },
        { label: "Baneados", value: stats.banned, c: "text-red-400" },
        { label: "En línea", value: stats.online, c: "text-violet-300" },
        { label: "Sets activos", value: stats.active_matches, c: "text-orange-300" },
    ];
    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {items.map((it) => (
                <div key={it.label} className="surface p-4 text-center" data-testid={`admin-stat-${it.label}`}>
                    <div className={`font-display text-2xl ${it.c}`}>{it.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-display mt-0.5">{it.label}</div>
                </div>
            ))}
        </div>
    );
}

function UsersPanel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);

    const load = useCallback(async (search = q) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
            setUsers(data);
        } catch (e) { toast.error(formatErr(e)); }
        finally { setLoading(false); }
    }, [q]);

    useEffect(() => { load(""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    useEffect(() => {
        const t = setTimeout(() => load(q), 280);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const toggleBan = async (u) => {
        try {
            await api.post(`/admin/users/${u.id}/ban`);
            toast.success(u.banned ? "Usuario desbaneado" : "Usuario baneado");
            await load(q);
        } catch (e) { toast.error(formatErr(e)); }
    };

    const onDelete = async (u) => {
        try {
            await api.delete(`/admin/users/${u.id}`);
            toast.success("Usuario eliminado");
            setConfirmDel(null);
            await load(q);
        } catch (e) { toast.error(formatErr(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar luchador…"
                        className="bg-ki-void border-white/10 pl-10"
                        data-testid="admin-users-search"
                    />
                </div>
                <Button onClick={() => load(q)} className="btn-ghost-violet" data-testid="admin-users-refresh">
                    <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
                </Button>
            </div>
            <div className="surface overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 text-[10px] uppercase tracking-widest font-display text-zinc-500 border-b border-white/5">
                    <div className="col-span-4">Luchador</div>
                    <div className="col-span-2">Rango</div>
                    <div className="col-span-1 text-center hidden md:block">Plat</div>
                    <div className="col-span-1 text-right">Pts</div>
                    <div className="col-span-1 text-center">V/D</div>
                    <div className="col-span-1 text-center">Estado</div>
                    <div className="col-span-2 text-right">Acciones</div>
                </div>
                {loading ? (
                    <div className="py-10 text-center text-zinc-500 font-display tracking-widest">Cargando…</div>
                ) : users.length === 0 ? (
                    <div className="py-10 text-center text-zinc-500">Sin resultados</div>
                ) : users.map((u) => (
                    <div key={u.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 hover:bg-ki-gold/5" data-testid={`admin-user-row-${u.id}`}>
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <FighterAvatar user={u} size={36} ring={false} />
                            <div className="min-w-0">
                                <div className="font-heading font-bold truncate flex items-center gap-2">
                                    {u.fighter_name}
                                    {u.role === "admin" && <Crown className="w-3 h-3 text-ki-gold" />}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-display tracking-widest uppercase truncate">
                                    {u.team_name ? `◈ ${u.team_name}` : "—"}
                                </div>
                            </div>
                        </div>
                        <div className="col-span-2"><RankBadge points={u.points} size="sm" /></div>
                        <div className="col-span-1 text-center hidden md:block">{u.platform && <PlatformBadge platform={u.platform} size="sm" />}</div>
                        <div className="col-span-1 text-right text-ki-gold font-display">{u.points}</div>
                        <div className="col-span-1 text-center text-xs text-zinc-400 font-display">{u.total_wins}/{u.total_losses}</div>
                        <div className="col-span-1 text-center">
                            {u.banned ? (
                                <span className="text-[10px] uppercase tracking-widest text-red-400 font-display border border-red-500/40 px-1.5 py-0.5">Baneado</span>
                            ) : (
                                <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-display border border-emerald-500/30 px-1.5 py-0.5">Activo</span>
                            )}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                            <Button onClick={() => setEditing(u)} className="btn-ghost-violet px-2 py-1" data-testid={`admin-user-edit-${u.id}`} title="Editar">
                                <Edit className="w-3 h-3" />
                            </Button>
                            {u.role !== "admin" && (
                                <Button onClick={() => toggleBan(u)} className={u.banned ? "btn-primary px-2 py-1" : "btn-danger px-2 py-1"} data-testid={`admin-user-ban-${u.id}`} title={u.banned ? "Desbanear" : "Banear"}>
                                    {u.banned ? <ShieldCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                </Button>
                            )}
                            {u.role !== "admin" && (
                                <Button onClick={() => setConfirmDel(u)} className="btn-danger px-2 py-1" data-testid={`admin-user-del-${u.id}`} title="Eliminar">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {editing && (
                <UserEditDialog
                    user={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await load(q); }}
                />
            )}
            {confirmDel && (
                <Dialog open onOpenChange={(v) => !v && setConfirmDel(null)}>
                    <DialogContent className="glass-dark border-white/10">
                        <DialogHeader>
                            <DialogTitle className="font-display tracking-widest text-red-400">¿Eliminar a {confirmDel.fighter_name}?</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Esta acción borrará al luchador y todo su rastro (combates, equipo, amigos). No se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setConfirmDel(null)} className="btn-ghost-violet">Cancelar</Button>
                            <Button onClick={() => onDelete(confirmDel)} className="btn-danger" data-testid="admin-user-del-confirm">Eliminar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

function UserEditDialog({ user, onClose, onSaved }) {
    const [f, setF] = useState({
        fighter_name: user.fighter_name,
        country: user.country || "",
        platform: user.platform || "PC",
        points: user.points,
        win_streak: user.win_streak,
        best_streak: user.best_streak,
        total_wins: user.total_wins,
        total_losses: user.total_losses,
        sets_won: user.sets_won,
        sets_lost: user.sets_lost,
        password: "",
    });
    const [saving, setSaving] = useState(false);
    const change = (k, v) => setF((p) => ({ ...p, [k]: v }));

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                fighter_name: f.fighter_name,
                country: f.country || "",
                platform: f.platform,
                points: Number(f.points),
                win_streak: Number(f.win_streak),
                best_streak: Number(f.best_streak),
                total_wins: Number(f.total_wins),
                total_losses: Number(f.total_losses),
                sets_won: Number(f.sets_won),
                sets_lost: Number(f.sets_lost),
            };
            if (f.password.trim()) payload.password = f.password;
            await api.put(`/admin/users/${user.id}`, payload);
            toast.success("Cambios guardados");
            onSaved();
        } catch (e) { toast.error(formatErr(e)); }
        finally { setSaving(false); }
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="glass-dark border-white/10 max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display tracking-widest text-glow-gold flex items-center gap-3">
                        <FighterAvatar user={user} size={40} ring={false} />
                        Editar {user.fighter_name}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Modifica cualquier campo. Los cambios afectan a la clasificación al instante.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-2">
                    <Field label="Nombre">
                        <Input value={f.fighter_name} onChange={(e) => change("fighter_name", e.target.value)} className="bg-ki-surface border-white/10" data-testid="admin-edit-name" />
                    </Field>
                    <Field label="Plataforma">
                        <Select value={f.platform} onValueChange={(v) => change("platform", v)}>
                            <SelectTrigger className="bg-ki-surface border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-ki-surface border-white/10">
                                <SelectItem value="PC">PC</SelectItem>
                                <SelectItem value="PS5">PS5</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="País">
                        <Select value={f.country || "NONE"} onValueChange={(v) => change("country", v === "NONE" ? "" : v)}>
                            <SelectTrigger className="bg-ki-surface border-white/10"><SelectValue placeholder="Sin país" /></SelectTrigger>
                            <SelectContent className="bg-ki-surface border-white/10 max-h-72">
                                <SelectItem value="NONE">— Sin país —</SelectItem>
                                {COUNTRIES.map((c) => (
                                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Puntos">
                        <Input type="number" min={0} value={f.points} onChange={(e) => change("points", e.target.value)} className="bg-ki-surface border-white/10" data-testid="admin-edit-points" />
                    </Field>
                    <Field label="Partidas ganadas">
                        <Input type="number" min={0} value={f.total_wins} onChange={(e) => change("total_wins", e.target.value)} className="bg-ki-surface border-white/10" data-testid="admin-edit-wins" />
                    </Field>
                    <Field label="Partidas perdidas">
                        <Input type="number" min={0} value={f.total_losses} onChange={(e) => change("total_losses", e.target.value)} className="bg-ki-surface border-white/10" data-testid="admin-edit-losses" />
                    </Field>
                    <Field label="Sets ganados">
                        <Input type="number" min={0} value={f.sets_won} onChange={(e) => change("sets_won", e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                    <Field label="Sets perdidos">
                        <Input type="number" min={0} value={f.sets_lost} onChange={(e) => change("sets_lost", e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                    <Field label="Racha actual">
                        <Input type="number" min={0} value={f.win_streak} onChange={(e) => change("win_streak", e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                    <Field label="Mejor racha">
                        <Input type="number" min={0} value={f.best_streak} onChange={(e) => change("best_streak", e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                    <Field label="Nueva contraseña (opcional)" colSpan={2}>
                        <Input type="password" value={f.password} onChange={(e) => change("password", e.target.value)} placeholder="Dejar vacío para no cambiar" className="bg-ki-surface border-white/10" data-testid="admin-edit-password" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} className="btn-ghost-violet">Cancelar</Button>
                    <Button onClick={save} disabled={saving} className="btn-primary" data-testid="admin-edit-save">
                        {saving ? "Guardando…" : "Guardar cambios"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, colSpan = 1, children }) {
    return (
        <div className={`space-y-1 ${colSpan === 2 ? "col-span-2" : ""}`}>
            <Label className="text-[10px] uppercase tracking-widest text-zinc-400 font-display">{label}</Label>
            {children}
        </div>
    );
}

function TeamsPanel() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { const { data } = await api.get("/admin/teams"); setTeams(data); }
        catch (e) { toast.error(formatErr(e)); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const onDelete = async (t) => {
        try {
            await api.delete(`/admin/teams/${t.id}`);
            toast.success("Equipo eliminado");
            setConfirmDel(null);
            await load();
        } catch (e) { toast.error(formatErr(e)); }
    };

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="py-10 text-center text-zinc-500 font-display tracking-widest">Cargando…</div>
            ) : teams.length === 0 ? (
                <div className="text-center surface p-10 text-zinc-500">Sin equipos registrados</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((t) => (
                        <div key={t.id} className="surface p-5" data-testid={`admin-team-${t.id}`}>
                            <div className="flex items-start gap-3">
                                <div className="w-14 h-14 clip-hex bg-ki-void border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                                    {t.logo ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover" /> : <Shield className="w-6 h-6 text-zinc-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-heading font-bold truncate">{t.name}</div>
                                    <div className="text-xs text-zinc-500 font-body line-clamp-2">{t.description || "—"}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 text-xs uppercase tracking-widest font-display text-zinc-400">
                                <span>{t.member_count} miembros</span>
                                <span className="text-ki-gold">{t.total_points} pts</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Button onClick={() => setEditing(t)} className="btn-ghost-violet flex-1 text-xs"><Edit className="w-3 h-3 mr-1" /> Editar</Button>
                                <Button onClick={() => setConfirmDel(t)} className="btn-danger flex-1 text-xs"><Trash2 className="w-3 h-3 mr-1" /> Borrar</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {editing && (
                <TeamEditDialog team={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
            )}
            {confirmDel && (
                <Dialog open onOpenChange={(v) => !v && setConfirmDel(null)}>
                    <DialogContent className="glass-dark border-white/10">
                        <DialogHeader>
                            <DialogTitle className="font-display tracking-widest text-red-400">¿Eliminar equipo {confirmDel.name}?</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Los miembros perderán este equipo. No se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setConfirmDel(null)} className="btn-ghost-violet">Cancelar</Button>
                            <Button onClick={() => onDelete(confirmDel)} className="btn-danger">Eliminar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

function TeamEditDialog({ team, onClose, onSaved }) {
    const [name, setName] = useState(team.name);
    const [desc, setDesc] = useState(team.description || "");
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await api.put(`/admin/teams/${team.id}`, { name, description: desc });
            toast.success("Equipo actualizado");
            onSaved();
        } catch (e) { toast.error(formatErr(e)); }
        finally { setSaving(false); }
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="glass-dark border-white/10">
                <DialogHeader>
                    <DialogTitle className="font-display tracking-widest text-glow-gold">Editar equipo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Field label="Nombre">
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                    <Field label="Descripción">
                        <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="bg-ki-surface border-white/10" />
                    </Field>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} className="btn-ghost-violet">Cancelar</Button>
                    <Button onClick={save} disabled={saving} className="btn-primary">Guardar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
