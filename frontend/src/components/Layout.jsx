import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMatchmaking } from "@/contexts/MatchmakingContext";
import FighterAvatar from "@/components/FighterAvatar";
import RankBadge from "@/components/RankBadge";
import { LogOut, Trophy, Swords, Shield, Users, History as HistoryIcon, User, Heart, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
    { to: "/", label: "Combate", icon: Swords },
    { to: "/leaderboard", label: "Clasificación", icon: Trophy },
    { to: "/teams", label: "Equipos", icon: Shield },
    { to: "/friends", label: "Amigos", icon: Users },
    { to: "/history", label: "Historial", icon: HistoryIcon },
    { to: "/profile", label: "Perfil", icon: User },
];

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const { connected } = useMatchmaking();
    const navigate = useNavigate();

    const onLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex flex-col relative">
            <header className="sticky top-0 z-40 glass-dark border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
                        <div className="w-10 h-10 rounded-sm clip-hex bg-gradient-to-br from-ki-gold via-orange-500 to-red-500 flex items-center justify-center">
                            <span className="font-display text-black text-xl font-black">Z</span>
                        </div>
                        <div className="leading-none">
                            <div className="font-display text-lg sm:text-xl tracking-[0.25em] text-glow-gold">SPARKING ZONE</div>
                            <div className="font-heading text-[10px] uppercase tracking-[0.3em] text-zinc-500">matchmaking · sparking zero</div>
                        </div>
                    </Link>
                    <nav className="hidden lg:flex items-center gap-1">
                        {navItems.map((it) => (
                            <NavLink
                                key={it.to}
                                to={it.to}
                                end={it.to === "/"}
                                data-testid={`nav-${it.label.toLowerCase()}`}
                                className={({ isActive }) =>
                                    `font-display tracking-widest uppercase text-xs px-3 py-2 rounded-sm flex items-center gap-2 transition-all ${
                                        isActive ? "text-ki-gold bg-ki-gold/10" : "text-zinc-400 hover:text-white"
                                    }`
                                }
                            >
                                <it.icon className="w-4 h-4" /> {it.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <div title={connected ? "Conectado" : "Desconectado"}>
                            {connected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                        </div>
                        {user && user.id && (
                            <Link to="/profile" className="hidden sm:flex items-center gap-3 group" data-testid="header-user">
                                <div className="text-right">
                                    <div className="font-heading text-sm font-bold tracking-wide text-white group-hover:text-ki-gold transition-colors">{user.fighter_name}</div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="text-xs text-ki-gold font-display tracking-wider">{user.points} PTS</span>
                                        <RankBadge points={user.points || 0} size="sm" showName={false} />
                                    </div>
                                </div>
                                <FighterAvatar user={user} size={42} />
                            </Link>
                        )}
                        <Button onClick={onLogout} className="btn-danger px-3 py-2" data-testid="logout-btn">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                {/* Mobile nav */}
                <div className="lg:hidden border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-2 py-2 grid grid-cols-6 gap-1">
                        {navItems.map((it) => (
                            <NavLink
                                key={it.to}
                                to={it.to}
                                end={it.to === "/"}
                                className={({ isActive }) =>
                                    `flex flex-col items-center gap-0.5 py-2 rounded-sm text-[9px] uppercase tracking-widest font-display ${
                                        isActive ? "text-ki-gold" : "text-zinc-500"
                                    }`
                                }
                            >
                                <it.icon className="w-4 h-4" />
                                {it.label}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </header>
            <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
                {children}
            </main>
            <footer className="text-center py-6 text-xs text-zinc-600 font-display tracking-widest uppercase">
                Sparking Zone — Plataforma fan no oficial · Que tu ki te acompañe
            </footer>
        </div>
    );
}
