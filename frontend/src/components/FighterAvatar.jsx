import { rankFor } from "@/lib/game";
import { User } from "lucide-react";

export default function FighterAvatar({ user, size = 56, ring = true, className = "" }) {
    const points = user?.points || 0;
    const r = rankFor(points);
    const src = user?.avatar;
    return (
        <div
            className={`relative inline-flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            {ring && (
                <span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 0 2px ${r.color}, 0 0 14px ${r.glow}` }}
                />
            )}
            <div
                className="w-full h-full rounded-full overflow-hidden bg-ki-surface flex items-center justify-center border border-white/5"
                style={{ width: size, height: size }}
            >
                {src ? (
                    <img src={src} alt={user?.fighter_name || "avatar"} className="w-full h-full object-cover" />
                ) : (
                    <User className="text-zinc-500" style={{ width: size * 0.5, height: size * 0.5 }} />
                )}
            </div>
        </div>
    );
}
