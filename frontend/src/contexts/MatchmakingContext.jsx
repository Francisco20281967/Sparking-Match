import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MMContext = createContext(null);

const initialState = {
    status: "idle", // idle | queued | match_found | in_progress | finished | rejected
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
    pendingRoundReport: false,
    online: 0,
    queue_pc: 0,
    queue_ps5: 0,
    error: null,
    lastEvent: null,
};

function fromApi(d) {
    return {
        status: d.status,
        matchId: d.match_id,
        opponent: d.opponent,
        scores: d.scores || {},
        rounds: d.rounds || [],
        iAccepted: !!d.i_accepted,
        opponentAccepted: !!d.opponent_accepted,
        iWantRematch: !!d.i_want_rematch,
        opponentWantsRematch: !!d.opponent_wants_rematch,
        setWinnerId: d.set_winner_id,
        pointsDelta: d.points_delta || 0,
        pendingRoundReport: !!d.pending_round_report,
        online: d.online || 0,
        queue_pc: d.queue_pc || 0,
        queue_ps5: d.queue_ps5 || 0,
        error: null,
        lastEvent: null,
    };
}

export function MatchmakingProvider({ children }) {
    const { user, refresh } = useAuth();
    const [state, setState] = useState(initialState);
    const [connected, setConnected] = useState(false);
    const prevRef = useRef(initialState);
    const pollingRef = useRef(null);
    const inflightRef = useRef(false);

    const applyState = useCallback((d) => {
        const next = fromApi(d);
        const prev = prevRef.current;
        // Detect transitions to drive side-effects
        if (prev.status !== "finished" && next.status === "finished") {
            // points changed: refresh user
            refresh?.();
        }
        if (prev.matchId && !next.matchId && prev.status !== "finished" && next.status === "idle") {
            // match disappeared (opponent left or we left)
        }
        if (prev.status === "queued" && next.status === "match_found") {
            // sound/flash effect could go here
        }
        prevRef.current = next;
        setState(next);
        setConnected(true);
    }, [refresh]);

    // Poll loop
    useEffect(() => {
        if (!user || user === false) {
            setConnected(false);
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            return;
        }
        const tick = async () => {
            if (inflightRef.current) return;
            inflightRef.current = true;
            try {
                const { data } = await api.get("/match/state");
                applyState(data);
            } catch (e) {
                setConnected(false);
            } finally {
                inflightRef.current = false;
            }
        };
        tick();
        const interval = setInterval(tick, 1500);
        pollingRef.current = interval;
        return () => {
            clearInterval(interval);
            pollingRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const callAction = useCallback(async (path, body) => {
        try {
            const { data } = await api.post(path, body || {});
            applyState(data);
            return data;
        } catch (e) {
            toast.error(formatErr(e));
            throw e;
        }
    }, [applyState]);

    const joinQueue = () => callAction("/match/queue");
    const leaveQueue = () => callAction("/match/dequeue");
    const acceptMatch = () => callAction("/match/accept");
    const rejectMatch = () => callAction("/match/reject");
    const reportRound = (winnerId) => callAction("/match/round", { winner_id: winnerId });
    const requestRematch = () => callAction("/match/rematch");
    const leaveMatch = () => callAction("/match/leave");
    const reset = () => setState(initialState);

    return (
        <MMContext.Provider
            value={{
                connected,
                state,
                joinQueue,
                leaveQueue,
                acceptMatch,
                rejectMatch,
                reportRound,
                requestRematch,
                leaveMatch,
                reset,
            }}
        >
            {children}
        </MMContext.Provider>
    );
}

export function useMatchmaking() {
    return useContext(MMContext);
}
