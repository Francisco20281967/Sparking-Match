import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { wsUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const MMContext = createContext(null);

const initialState = {
    status: "idle", // idle | queued | match_found | accepted | in_progress | finished | rejected
    matchId: null,
    opponent: null,
    scores: {},
    rounds: [],
    iAccepted: false,
    opponentAccepted: false,
    iWantRematch: false,
    opponentWantsRematch: false,
    setWinnerId: null,
    pointsDelta: 0,
    lastEvent: null,
    error: null,
    pendingRoundReport: false,
    online: 0,
};

export function MatchmakingProvider({ children }) {
    const { user, refresh } = useAuth();
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [state, setState] = useState(initialState);

    const send = useCallback((payload) => {
        if (wsRef.current?.readyState === 1) {
            wsRef.current.send(JSON.stringify(payload));
            return true;
        }
        return false;
    }, []);

    const reset = useCallback(() => setState(initialState), []);

    useEffect(() => {
        if (!user || user === false) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setConnected(false);
            return;
        }
        let closed = false;
        let retryTimer = null;
        const connect = () => {
            const ws = new WebSocket(wsUrl("/api/ws/matchmaking"));
            wsRef.current = ws;
            ws.onopen = () => setConnected(true);
            ws.onclose = () => {
                setConnected(false);
                wsRef.current = null;
                if (!closed) {
                    retryTimer = setTimeout(connect, 1500);
                }
            };
            ws.onerror = () => {};
            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    handleMsg(msg);
                } catch (e) {}
            };
        };

        const handleMsg = (msg) => {
            switch (msg.type) {
                case "connected":
                    setState((s) => ({ ...s, lastEvent: "connected" }));
                    break;
                case "queued":
                    setState((s) => ({ ...s, status: "queued", lastEvent: "queued" }));
                    break;
                case "queue_left":
                    setState((s) => ({ ...s, status: "idle", lastEvent: "queue_left" }));
                    break;
                case "match_found":
                    setState((s) => ({
                        ...initialState,
                        status: "match_found",
                        matchId: msg.match_id,
                        opponent: msg.opponent,
                        lastEvent: "match_found",
                    }));
                    break;
                case "opponent_accepted":
                    setState((s) => ({ ...s, opponentAccepted: true, lastEvent: "opponent_accepted" }));
                    break;
                case "match_started":
                    setState((s) => ({ ...s, status: "in_progress", iAccepted: true, opponentAccepted: true, scores: { [user.id]: 0, [s.opponent?.id]: 0 }, rounds: [], lastEvent: "match_started" }));
                    break;
                case "round_pending":
                    setState((s) => ({ ...s, pendingRoundReport: true, lastEvent: "round_pending" }));
                    break;
                case "round_disagreement":
                    setState((s) => ({ ...s, pendingRoundReport: false, lastEvent: "round_disagreement", error: "Discrepancia en el resultado. Reportad de nuevo." }));
                    break;
                case "round_recorded":
                    setState((s) => ({
                        ...s,
                        scores: msg.scores,
                        rounds: [...s.rounds, { winner_id: msg.winner_id }],
                        pendingRoundReport: false,
                        lastEvent: "round_recorded",
                        error: null,
                    }));
                    break;
                case "set_finished":
                    setState((s) => ({
                        ...s,
                        status: "finished",
                        scores: msg.scores,
                        setWinnerId: msg.winner_id,
                        pointsDelta: msg.points_delta,
                        lastEvent: "set_finished",
                    }));
                    refresh();
                    break;
                case "match_rejected":
                    setState((s) => ({ ...initialState, status: "rejected", lastEvent: "match_rejected" }));
                    setTimeout(() => setState(initialState), 2200);
                    break;
                case "opponent_wants_rematch":
                    setState((s) => ({ ...s, opponentWantsRematch: true, lastEvent: "opponent_wants_rematch" }));
                    break;
                case "opponent_left":
                case "opponent_disconnected":
                    setState((s) => ({ ...initialState, status: "idle", lastEvent: msg.type, error: "El oponente se desconectó" }));
                    break;
                default:
                    break;
            }
        };

        connect();
        return () => {
            closed = true;
            if (retryTimer) clearTimeout(retryTimer);
            if (wsRef.current) {
                try { wsRef.current.close(); } catch {}
                wsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const joinQueue = () => send({ type: "join_queue" });
    const leaveQueue = () => send({ type: "leave_queue" });
    const acceptMatch = () => { send({ type: "accept", match_id: state.matchId }); setState((s) => ({ ...s, iAccepted: true })); };
    const rejectMatch = () => send({ type: "reject", match_id: state.matchId });
    const reportRound = (winnerId) => { send({ type: "report_round", match_id: state.matchId, winner_id: winnerId }); setState((s) => ({ ...s, pendingRoundReport: true })); };
    const requestRematch = () => { send({ type: "rematch", match_id: state.matchId }); setState((s) => ({ ...s, iWantRematch: true })); };
    const leaveMatch = () => { send({ type: "leave_match", match_id: state.matchId }); reset(); };

    return (
        <MMContext.Provider
            value={{ connected, state, joinQueue, leaveQueue, acceptMatch, rejectMatch, reportRound, requestRematch, leaveMatch, reset }}
        >
            {children}
        </MMContext.Provider>
    );
}

export function useMatchmaking() {
    return useContext(MMContext);
}
