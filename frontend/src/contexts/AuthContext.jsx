import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatErr } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking, false = unauth, object = authed
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
            return data;
        } catch (e) {
            setUser(false);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const login = async (fighter_name, password) => {
        const { data } = await api.post("/auth/login", { fighter_name, password });
        if (data.token) localStorage.setItem("sz_token", data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (fighter_name, password, platform) => {
        const { data } = await api.post("/auth/register", { fighter_name, password, platform });
        if (data.token) localStorage.setItem("sz_token", data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch {}
        localStorage.removeItem("sz_token");
        setUser(false);
    };

    const deleteAccount = async () => {
        await api.delete("/auth/account");
        localStorage.removeItem("sz_token");
        setUser(false);
    };

    return (
        <AuthContext.Provider value={{ user, loading, refresh, login, register, logout, deleteAccount, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

export { formatErr };
