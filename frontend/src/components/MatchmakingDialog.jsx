import { useEffect, useState } from "react";
import { useMatchmaking } from "@/contexts/MatchmakingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FighterAvatar from "@/components/FighterAvatar";
import RankBadge from "@/components/RankBadge";
import PlatformBadge from "@/components/PlatformBadge";
import { multiplierFor } from "@/lib/game";
import { Swords, Trophy, X, RotateCw, Check, Flame, Sparkles, ArrowRight } from "lucide-react";

export default function MatchmakingDialog() {
    const { state, acceptMatch, rejectMatch, reportRound, requestRematch, leaveMatch, leaveQueue } = useMatchmaking();
    const { user } = useAuth();
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (state.lastEvent === "match_found") {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 600);
            return () => clearTimeout(t);
        }
    }, [state.lastEvent]);

    const open = ["queued", "match_found", "in_progress", "finished", "rejected"].includes(state.status);

    if (!open) return null;

    const opp = state.opponent;
    const myScore = state.scores?.[user?.id] ?? 0;
    const oppScore = state.scores?.[opp?.id] ?? 0;
    const setOver = state.status === "finished";
    const iWon = state.setWinnerId === user?.id;
    const draw = setOver && state.setWinnerId == null;
    const mult = multiplierFor(user?.win_streak || 0);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) leaveMatch(); }}>
            <DialogContent
                className="max-w-3xl glass-dark border-white/10 p-0 overflow-hidden animate-fade-in"
                style={{ background: "rgba(5,3,10,0.92)" }}
                data-testid="matchmaking-dialog"
            >
                {flash && <div className="absolute inset-0 bg-ki-gold/30 animate-flash pointer-events-none" />}
                <div className="relative p-8 sm:p-10">
                    {state.status === "queued" && (
                        <div className="text-center space-y-6 py-6 animate-fade-in" data-testid="mm-queued">
                            <div className="flex justify-center">
                                <div className="relative w-32 h-32">
                                    <div className="absolute inset-0 rounded-full border-2 border-ki-gold animate-spin-slow" />
                                    <div className="absolute inset-3 rounded-full border-2 border-dashed border-ki-purple animate-aura-pulse" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Swords className="w-12 h-12 text-ki-gold animate-pulse" />
                                    </div>
                                </div>
                            </div>
                            <h2 className="font-display text-3xl tracking-[0.3em] text-glow-gold">BUSCANDO RIVAL</h2>
                            <p className="text-zinc-400 font-body">Tu ki está conectado al torneo. Esperando otro guerrero…</p>
                            <Button onClick={leaveQueue} className="btn-danger px-6" data-testid="mm-cancel-queue">
                                <X className="w-4 h-4 mr-2" /> Cancelar
                            </Button>
                        </div>
                    )}

                    {state.status === "match_found" && opp && (
                        <div className="space-y-8 animate-fade-in animate-shake" data-testid="mm-match-found">
                            <div className="text-center">
                                <div className="font-display text-xs tracking-[0.5em] text-ki-purple uppercase">Rival encontrado</div>
                                <h2 className="font-display text-4xl sm:text-5xl tracking-[0.2em] text-glow-gold mt-1">¡A LUCHAR!</h2>
                            </div>
                            <div className="grid grid-cols-3 gap-4 items-center">
                                <PlayerCorner user={user} mine />
                                <div className="flex flex-col items-center gap-2">
                                    <div className="font-display text-5xl text-ki-red text-glow-red">VS</div>
                                    <div className="text-[10px] font-display uppercase tracking-widest text-zinc-500">Mejor de 3</div>
                                </div>
                                <PlayerCorner user={opp} />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button onClick={rejectMatch} className="btn-danger flex-1 py-6 text-base" data-testid="mm-reject-btn">
                                    <X className="w-4 h-4 mr-2" /> Rechazar
                                </Button>
                                <Button onClick={acceptMatch} disabled={state.iAccepted} className="btn-primary flex-1 py-6 text-base" data-testid="mm-accept-btn">
                                    <Check className="w-4 h-4 mr-2" /> {state.iAccepted ? "Esperando rival..." : "Aceptar combate"}
                                </Button>
                            </div>
                            {state.opponentAccepted && !state.iAccepted && (
                                <div className="text-center text-xs uppercase tracking-widest text-emerald-400 font-display animate-pulse">
                                    El rival ha aceptado · espera tu confirmación
                                </div>
                            )}
                        </div>
                    )}

                    {state.status === "in_progress" && opp && (
                        <div className="space-y-6 animate-fade-in" data-testid="mm-in-progress">
                            <div className="text-center">
                                <div className="font-display text-xs tracking-[0.5em] text-ki-blue uppercase">Set en curso · Mejor de 3</div>
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Multiplicador actual: <span className="text-ki-gold">x{mult}</span></div>
                            </div>
                            <Scoreboard mine={user} opp={opp} myScore={myScore} oppScore={oppScore} rounds={state.rounds} />
                            {state.error && (
                                <div className="text-center text-xs uppercase tracking-widest text-red-400 font-display">{state.error}</div>
                            )}
                            <div className="space-y-3">
                                <div className="text-center text-xs uppercase tracking-widest text-zinc-400 font-display">¿Quién ganó la siguiente partida?</div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button onClick={() => reportRound(user.id)} disabled={state.pendingRoundReport} className="btn-primary flex-1 py-5" data-testid="mm-report-win">
                                        <Trophy className="w-4 h-4 mr-2" /> Yo gané
                                    </Button>
                                    <Button onClick={() => reportRound(opp.id)} disabled={state.pendingRoundReport} className="btn-ghost-violet flex-1 py-5" data-testid="mm-report-loss">
                                        Ganó {opp.fighter_name}
                                    </Button>
                                </div>
                                {state.pendingRoundReport && (
                                    <div className="text-center text-xs uppercase tracking-widest text-zinc-400 font-display animate-pulse">
                                        Esperando confirmación del rival…
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-center">
                                <Button onClick={leaveMatch} className="btn-danger" data-testid="mm-leave-match">
                                    <X className="w-4 h-4 mr-2" /> Abandonar
                                </Button>
                            </div>
                        </div>
                    )}

                    {state.status === "finished" && opp && (
                        <div className="space-y-6 animate-fade-in" data-testid="mm-finished">
                            <div className="text-center">
                                <div className="font-display text-xs tracking-[0.5em] text-zinc-500 uppercase">Set finalizado</div>
                                <h2
                                    className={`font-display text-4xl sm:text-5xl tracking-[0.2em] mt-1 ${
                                        iWon ? "text-glow-gold text-ki-gold" : draw ? "text-zinc-300" : "text-glow-red text-ki-red"
                                    }`}
                                >
                                    {iWon ? "VICTORIA" : draw ? "EMPATE" : "DERROTA"}
                                </h2>
                                <div className={`mt-2 font-display tracking-widest text-lg ${state.pointsDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {state.pointsDelta >= 0 ? "+" : ""}{state.pointsDelta} PUNTOS
                                </div>
                            </div>
                            <Scoreboard mine={user} opp={opp} myScore={myScore} oppScore={oppScore} rounds={state.rounds} />
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button onClick={leaveMatch} className="btn-danger flex-1 py-5" data-testid="mm-finish-leave">
                                    <ArrowRight className="w-4 h-4 mr-2" /> Salir
                                </Button>
                                <Button onClick={requestRematch} disabled={state.iWantRematch} className="btn-primary flex-1 py-5" data-testid="mm-rematch">
                                    <RotateCw className="w-4 h-4 mr-2" />
                                    {state.iWantRematch ? "Esperando rival…" : "Revancha (set completo)"}
                                </Button>
                            </div>
                            {state.opponentWantsRematch && !state.iWantRematch && (
                                <div className="text-center text-xs uppercase tracking-widest text-ki-gold font-display animate-pulse">
                                    Tu rival quiere revancha
                                </div>
                            )}
                        </div>
                    )}

                    {state.status === "rejected" && (
                        <div className="text-center space-y-3 py-6 animate-fade-in" data-testid="mm-rejected">
                            <Sparkles className="w-12 h-12 text-zinc-500 mx-auto" />
                            <h2 className="font-display text-3xl tracking-widest">Combate rechazado</h2>
                            <p className="text-zinc-400">Volviendo al inicio…</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PlayerCorner({ user, mine = false }) {
    if (!user) return null;
    return (
        <div className={`flex flex-col items-center gap-2 ${mine ? "" : ""}`}>
            <FighterAvatar user={user} size={92} />
            <div className="text-center">
                <div className="font-heading font-bold text-base sm:text-lg tracking-wide">{user.fighter_name}</div>
                <div className="flex items-center gap-1 justify-center mt-1 flex-wrap">
                    <RankBadge points={user.points || 0} size="sm" />
                    {user.platform && <PlatformBadge platform={user.platform} size="sm" />}
                </div>
                <div className="text-xs text-ki-gold font-display tracking-wider mt-1">{user.points || 0} PTS</div>
            </div>
        </div>
    );
}

function Scoreboard({ mine, opp, myScore, oppScore, rounds }) {
    return (
        <div className="grid grid-cols-3 items-center gap-4 surface p-6">
            <div className="text-center">
                <div className="font-heading font-bold text-sm truncate">{mine?.fighter_name}</div>
                <div className="font-display text-6xl sm:text-7xl text-ki-gold text-glow-gold mt-1">{myScore}</div>
            </div>
            <div className="text-center space-y-2">
                <div className="font-display text-zinc-500 tracking-widest text-xs">RONDA {Math.min(rounds.length + 1, 3)}/3</div>
                <div className="flex items-center justify-center gap-1">
                    {[0, 1, 2].map((i) => {
                        const r = rounds[i];
                        const w = r?.winner_id;
                        const cls = !r ? "border-zinc-700 bg-transparent" : w === mine?.id ? "bg-ki-gold border-ki-gold" : "bg-red-500 border-red-500";
                        return <span key={i} className={`w-3 h-3 rounded-full border ${cls}`} />;
                    })}
                </div>
            </div>
            <div className="text-center">
                <div className="font-heading font-bold text-sm truncate">{opp?.fighter_name}</div>
                <div className="font-display text-6xl sm:text-7xl text-red-400 text-glow-red mt-1">{oppScore}</div>
            </div>
        </div>
    );
}
