import { useEffect, useRef, useState } from "react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, LogOut, Upload, Crown } from "lucide-react";
import { toast } from "sonner";

export default function Teams() {
    const { user, refresh } = useAuth();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [logo, setLogo] = useState(null);
    const fileRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [detail, setDetail] = useState(null);

    const load = async () => {
        setLoading(true);
        try { const { data } = await api.get("/teams"); setTeams(data); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const onLogo = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 800_000) {
            toast.error("Logo demasiado grande (máx 800KB)");
            return;
        }
        const r = new FileReader();
        r.onload = () => setLogo(r.result);
        r.readAsDataURL(f);
    };

    const create = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await api.post("/teams", { name: name.trim(), description: desc.trim(), logo });
            toast.success("Equipo creado");
            setCreateOpen(false);
            setName(""); setDesc(""); setLogo(null);
            await refresh();
            await load();
        } catch (e) { toast.error(formatErr(e)); }
        finally { setSaving(false); }
    };

    const join = async (id) => {
        try {
            await api.post(`/teams/${id}/join`);
            toast.success("Te has unido al equipo");
            await refresh();
            await load();
        } catch (e) { toast.error(formatErr(e)); }
    };

    const leave = async () => {
        try {
            await api.post("/teams/leave");
            toast.success("Saliste del equipo");
            await refresh();
            await load();
        } catch (e) { toast.error(formatErr(e)); }
    };

    const openDetail = async (id) => {
        try { const { data } = await api.get(`/teams/${id}`); setDetail(data); }
        catch (e) { toast.error(formatErr(e)); }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-[0.5em] text-ki-purple font-display">Hermandad</div>
                    <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-glow-violet mt-1">EQUIPOS</h1>
                </div>
                <div className="flex gap-2">
                    {user?.team_id && (
                        <Button onClick={leave} className="btn-danger" data-testid="teams-leave-btn">
                            <LogOut className="w-4 h-4 mr-2" /> Salir del equipo
                        </Button>
                    )}
                    {!user?.team_id && (
                        <Button onClick={() => setCreateOpen(true)} className="btn-primary" data-testid="teams-create-btn">
                            <Plus className="w-4 h-4 mr-2" /> Crear equipo
                        </Button>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="text-center text-zinc-500 py-10 font-display tracking-widest">Cargando equipos…</div>
            ) : teams.length === 0 ? (
                <div className="text-center surface p-10">
                    <Shield className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <div className="font-display tracking-widest text-zinc-400">Aún no hay equipos. Sé el primero en formar una hermandad.</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {teams.map((t) => (
                        <div key={t.id} className="surface p-5 cursor-pointer" onClick={() => openDetail(t.id)} data-testid={`team-card-${t.id}`}>
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 clip-hex bg-ki-void border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                                    {t.logo ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover" /> : <Shield className="w-7 h-7 text-zinc-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-heading font-bold text-lg truncate">{t.name}</div>
                                    <div className="text-xs text-zinc-500 font-body line-clamp-2">{t.description || "—"}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 text-xs uppercase tracking-widest font-display text-zinc-400">
                                <span>{t.member_count} miembros</span>
                                <span className="text-ki-gold">{t.total_points} pts</span>
                            </div>
                            {!user?.team_id && (
                                <Button
                                    onClick={(e) => { e.stopPropagation(); join(t.id); }}
                                    className="btn-ghost-violet w-full mt-4"
                                    data-testid={`team-join-${t.id}`}
                                >
                                    Unirme
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="glass-dark border-white/10">
                    <DialogHeader>
                        <DialogTitle className="font-display tracking-widest text-glow-gold">Forjar nuevo equipo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs uppercase tracking-widest font-display text-zinc-400">Nombre del equipo</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="bg-ki-surface border-white/10 mt-1" data-testid="team-name-input" />
                        </div>
                        <div>
                            <Label className="text-xs uppercase tracking-widest font-display text-zinc-400">Descripción</Label>
                            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={240} rows={3} className="bg-ki-surface border-white/10 mt-1" data-testid="team-desc-input" />
                        </div>
                        <div>
                            <Label className="text-xs uppercase tracking-widest font-display text-zinc-400">Emblema</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="w-16 h-16 clip-hex bg-ki-void border border-white/10 overflow-hidden flex items-center justify-center">
                                    {logo ? <img src={logo} alt="logo" className="w-full h-full object-cover" /> : <Shield className="w-6 h-6 text-zinc-600" />}
                                </div>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} data-testid="team-logo-input" />
                                <Button onClick={() => fileRef.current?.click()} className="btn-ghost-violet" type="button">
                                    <Upload className="w-4 h-4 mr-2" /> Subir
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setCreateOpen(false)} className="btn-ghost-violet">Cancelar</Button>
                        <Button onClick={create} disabled={saving || !name.trim()} className="btn-primary" data-testid="team-create-submit">
                            {saving ? "Creando..." : "Crear equipo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
                <DialogContent className="glass-dark border-white/10 max-w-2xl">
                    {detail && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="font-display tracking-widest text-glow-gold flex items-center gap-3">
                                    <div className="w-12 h-12 clip-hex bg-ki-void border border-white/10 overflow-hidden flex items-center justify-center">
                                        {detail.logo ? <img src={detail.logo} alt={detail.name} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-zinc-600" />}
                                    </div>
                                    {detail.name}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                                <p className="text-zinc-400 text-sm">{detail.description || "Sin descripción"}</p>
                                <div className="text-xs uppercase tracking-widest font-display text-zinc-500">Miembros · {detail.members.length}</div>
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                                    {detail.members.map((m) => (
                                        <div key={m.id} className="flex items-center justify-between border border-white/5 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-heading font-bold">{m.fighter_name}</span>
                                                {m.id === detail.owner_id && <Crown className="w-3 h-3 text-ki-gold" />}
                                            </div>
                                            <span className="text-ki-gold font-display text-sm">{m.points} pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
