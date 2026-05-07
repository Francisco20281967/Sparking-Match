import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, formatErr } from "@/lib/api";
import { COUNTRIES, countryByCode } from "@/lib/game";
import AvatarUpload from "@/components/AvatarUpload";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import FighterAvatar from "@/components/FighterAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Save, UserCog } from "lucide-react";

export default function Profile() {
    const { user, refresh, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const [country, setCountry] = useState(user?.country || "");
    const [platform, setPlatform] = useState(user?.platform || "PC");
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [newName, setNewName] = useState(user?.fighter_name || "");
    const [savingName, setSavingName] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setCountry(user?.country || "");
        setPlatform(user?.platform || "PC");
        setNewName(user?.fighter_name || "");
    }, [user?.id]);

    if (!user) return null;

    const last = user.last_name_change_at;
    let daysLeft = 0;
    if (last) {
        const diff = Date.now() - new Date(last).getTime();
        const remaining = 14 * 24 * 3600 * 1000 - diff;
        if (remaining > 0) daysLeft = Math.ceil(remaining / (24 * 3600 * 1000));
    }

    const saveProfile = async () => {
        setSavingProfile(true);
        try {
            await api.put("/users/me/profile", { country: country || null, platform });
            await refresh();
            toast.success("Perfil actualizado");
        } catch (e) {
            toast.error(formatErr(e));
        } finally {
            setSavingProfile(false);
        }
    };

    const saveAvatar = async (b64) => {
        setSavingAvatar(true);
        try {
            await api.put("/users/me/profile", { avatar: b64 });
            await refresh();
            toast.success("Avatar actualizado");
        } catch (e) {
            toast.error(formatErr(e));
        } finally {
            setSavingAvatar(false);
        }
    };

    const saveName = async () => {
        if (!newName.trim() || newName === user.fighter_name) return;
        setSavingName(true);
        try {
            await api.put("/users/me/fighter-name", { fighter_name: newName.trim() });
            await refresh();
            toast.success("Nombre cambiado. Disponible de nuevo en 2 semanas.");
        } catch (e) {
            toast.error(formatErr(e));
        } finally {
            setSavingName(false);
        }
    };

    const onDelete = async () => {
        try {
            await deleteAccount();
            toast.success("Cuenta eliminada");
            navigate("/login");
        } catch (e) {
            toast.error(formatErr(e));
        }
    };

    const c = countryByCode(country);

    return (
        <div className="space-y-6">
            <header className="surface p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <FighterAvatar user={user} size={104} />
                <div className="flex-1 space-y-2">
                    <h1 className="font-display text-3xl sm:text-4xl tracking-widest text-glow-gold">{user.fighter_name}</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <RankBadge points={user.points} size="lg" />
                        {user.platform && <PlatformBadge platform={user.platform} size="lg" />}
                        {c && <span className="text-sm border border-white/15 px-2 py-1 font-display uppercase tracking-widest">{c.flag} {c.name}</span>}
                        {user.team_name && <span className="text-sm border border-white/15 px-2 py-1 font-display uppercase tracking-widest">◈ {user.team_name}</span>}
                    </div>
                    <div className="text-sm text-zinc-400 font-body">
                        {user.points} puntos · {user.total_wins} V / {user.total_losses} D · racha actual {user.win_streak} (mejor: {user.best_streak})
                    </div>
                </div>
            </header>

            <Tabs defaultValue="info">
                <TabsList className="bg-ki-surface border border-white/5 grid grid-cols-3 sm:w-auto sm:inline-grid">
                    <TabsTrigger value="info" data-testid="profile-tab-info">Datos</TabsTrigger>
                    <TabsTrigger value="avatar" data-testid="profile-tab-avatar">Avatar</TabsTrigger>
                    <TabsTrigger value="account" data-testid="profile-tab-account">Cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="surface p-6 mt-4 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-widest text-zinc-400 font-display">País</Label>
                            <Select value={country || "NONE"} onValueChange={(v) => setCountry(v === "NONE" ? "" : v)}>
                                <SelectTrigger className="bg-ki-surface border-white/10" data-testid="profile-country-select">
                                    <SelectValue placeholder="Selecciona país" />
                                </SelectTrigger>
                                <SelectContent className="bg-ki-surface border-white/10 max-h-72">
                                    <SelectItem value="NONE">— Sin país —</SelectItem>
                                    {COUNTRIES.map((c) => (
                                        <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-widest text-zinc-400 font-display">Plataforma</Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger className="bg-ki-surface border-white/10" data-testid="profile-platform-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-ki-surface border-white/10">
                                    <SelectItem value="PC">PC</SelectItem>
                                    <SelectItem value="PS5">PS5</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button onClick={saveProfile} disabled={savingProfile} className="btn-primary" data-testid="profile-save-info-btn">
                        <Save className="w-4 h-4 mr-2" /> {savingProfile ? "Guardando..." : "Guardar cambios"}
                    </Button>
                </TabsContent>

                <TabsContent value="avatar" className="surface p-6 mt-4">
                    <AvatarUpload initial={user.avatar} onSave={saveAvatar} saving={savingAvatar} />
                </TabsContent>

                <TabsContent value="account" className="surface p-6 mt-4 space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 font-display tracking-widest text-zinc-300 uppercase text-sm">
                            <UserCog className="w-4 h-4 text-ki-gold" /> Cambio de nombre de luchador
                        </div>
                        <p className="text-xs text-zinc-500">
                            Una vez confirmado el cambio, deberás esperar 2 semanas para volver a cambiarlo.
                            {daysLeft > 0 && ` Te quedan aproximadamente ${daysLeft} día(s) para volver a cambiarlo.`}
                        </p>
                        <div className="flex gap-3">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                disabled={daysLeft > 0}
                                className="bg-ki-surface border-white/10 max-w-xs"
                                data-testid="profile-newname-input"
                            />
                            <Button
                                onClick={saveName}
                                disabled={savingName || daysLeft > 0 || newName.trim() === user.fighter_name}
                                className="btn-ghost-violet"
                                data-testid="profile-save-name-btn"
                            >
                                {savingName ? "Guardando..." : "Cambiar nombre"}
                            </Button>
                        </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 space-y-3">
                        <div className="flex items-center gap-2 font-display tracking-widest text-red-400 uppercase text-sm">
                            <Trash2 className="w-4 h-4" /> Zona de peligro
                        </div>
                        <p className="text-xs text-zinc-500">Eliminar tu cuenta borrará tu rastro de los rankings, equipos y combates.</p>
                        <Button onClick={() => setConfirmDelete(true)} className="btn-danger" data-testid="profile-delete-account-btn">
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar cuenta
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <DialogContent className="glass-dark border-white/10">
                    <DialogHeader>
                        <DialogTitle className="font-display tracking-widest text-red-400">¿Eliminar tu cuenta?</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Esta acción no se puede deshacer. Tu nombre desaparecerá de todas las clasificaciones, equipos y combates registrados.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button onClick={() => setConfirmDelete(false)} className="btn-ghost-violet" data-testid="profile-delete-cancel">Cancelar</Button>
                        <Button onClick={onDelete} className="btn-danger" data-testid="profile-delete-confirm">Eliminar definitivamente</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
