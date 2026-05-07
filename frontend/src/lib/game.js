// Game-related helpers (rank, multiplier, points, formatting)

export const RANKS = [
    { min: 0, max: 49, name: "Guerrero de clase baja", short: "Clase Baja", color: "#94a3b8", glow: "rgba(148,163,184,0.5)", icon: "swords" },
    { min: 50, max: 149, name: "Guerrero de clase media", short: "Clase Media", color: "#34d399", glow: "rgba(52,211,153,0.6)", icon: "shield" },
    { min: 150, max: 249, name: "Guerrero de clase alta", short: "Clase Alta", color: "#f97316", glow: "rgba(249,115,22,0.7)", icon: "flame" },
    { min: 250, max: 499, name: "Dios", short: "Dios", color: "#a855f7", glow: "rgba(168,85,247,0.85)", icon: "sparkles" },
    { min: 500, max: Infinity, name: "Leyenda", short: "Leyenda", color: "#facc15", glow: "rgba(250,204,21,1)", icon: "crown" },
];

export function rankFor(points) {
    return RANKS.find((r) => points >= r.min && points <= r.max) || RANKS[0];
}

export function rankProgress(points) {
    const r = rankFor(points);
    if (!isFinite(r.max)) return { percent: 100, next: null, remaining: 0 };
    const span = r.max - r.min + 1;
    const within = points - r.min;
    return { percent: Math.min(100, Math.round((within / span) * 100)), next: r.max + 1, remaining: r.max + 1 - points };
}

export function multiplierFor(streak) {
    return Math.min(1 + 0.5 * streak, 10);
}

export const COUNTRIES = [
    { code: "ES", name: "España", flag: "🇪🇸" },
    { code: "MX", name: "México", flag: "🇲🇽" },
    { code: "AR", name: "Argentina", flag: "🇦🇷" },
    { code: "CL", name: "Chile", flag: "🇨🇱" },
    { code: "CO", name: "Colombia", flag: "🇨🇴" },
    { code: "PE", name: "Perú", flag: "🇵🇪" },
    { code: "VE", name: "Venezuela", flag: "🇻🇪" },
    { code: "EC", name: "Ecuador", flag: "🇪🇨" },
    { code: "UY", name: "Uruguay", flag: "🇺🇾" },
    { code: "PY", name: "Paraguay", flag: "🇵🇾" },
    { code: "BO", name: "Bolivia", flag: "🇧🇴" },
    { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
    { code: "PA", name: "Panamá", flag: "🇵🇦" },
    { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
    { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
    { code: "GT", name: "Guatemala", flag: "🇬🇹" },
    { code: "HN", name: "Honduras", flag: "🇭🇳" },
    { code: "SV", name: "El Salvador", flag: "🇸🇻" },
    { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
    { code: "CU", name: "Cuba", flag: "🇨🇺" },
    { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
    { code: "BR", name: "Brasil", flag: "🇧🇷" },
    { code: "PT", name: "Portugal", flag: "🇵🇹" },
    { code: "FR", name: "Francia", flag: "🇫🇷" },
    { code: "IT", name: "Italia", flag: "🇮🇹" },
    { code: "DE", name: "Alemania", flag: "🇩🇪" },
    { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
    { code: "JP", name: "Japón", flag: "🇯🇵" },
    { code: "KR", name: "Corea del Sur", flag: "🇰🇷" },
    { code: "OTHER", name: "Otro", flag: "🌍" },
];

export function countryByCode(code) {
    return COUNTRIES.find((c) => c.code === code);
}

export function winRate(wins, losses) {
    const total = (wins || 0) + (losses || 0);
    if (!total) return 0;
    return Math.round((wins / total) * 100);
}
