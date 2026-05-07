import { rankFor } from "@/lib/game";
import { Crown, Sparkles, Flame, Shield, Swords } from "lucide-react";

const ICONS = { swords: Swords, shield: Shield, flame: Flame, sparkles: Sparkles, crown: Crown };

export default function RankBadge({ points = 0, size = "md", showName = true, className = "" }) {
    const r = rankFor(points);
    const Icon = ICONS[r.icon] || Swords;
    const sizes = {
        sm: "px-2 py-0.5 text-[10px] gap-1",
        md: "px-3 py-1 text-xs gap-1.5",
        lg: "px-4 py-1.5 text-sm gap-2",
    };
    return (
        <span
            data-testid="rank-badge"
            className={`inline-flex items-center font-display tracking-[0.18em] uppercase border rounded-sm ${sizes[size]} ${className}`}
            style={{ borderColor: r.color, color: r.color, boxShadow: `0 0 12px ${r.glow}, inset 0 0 6px ${r.glow}` }}
        >
            <Icon className={size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"} />
            {showName && <span>{r.short}</span>}
        </span>
    );
}
