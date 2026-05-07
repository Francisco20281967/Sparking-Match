import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    withCredentials: true,
});

// attach token from localStorage as a fallback header (cookies are primary)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("sz_token");
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export function wsUrl(path) {
    const url = new URL(BACKEND_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = path;
    const token = localStorage.getItem("sz_token");
    if (token) url.searchParams.set("token", token);
    return url.toString();
}

export function formatErr(err) {
    const d = err?.response?.data?.detail;
    if (!d) return err?.message || "Error inesperado";
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" · ");
    return String(d);
}
