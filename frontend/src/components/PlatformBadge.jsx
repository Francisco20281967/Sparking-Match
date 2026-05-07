import { Monitor, Gamepad2 } from "lucide-react";

export default function PlatformBadge({ platform, size = "md" }) {
    const isPC = platform === "PC";
    const Icon = isPC ? Monitor : Gamepad2;
    const sizes = {
        sm: "text-[10px] px-1.5 py-0.5 gap-1",
        md: "text-xs px-2 py-0.5 gap-1.5",
        lg: "text-sm px-2.5 py-1 gap-1.5",
    };
    const ic = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5";
    return (
        <span
            data-testid={`platform-badge-${platform}`}
            className={`inline-flex items-center font-display uppercase tracking-widest border rounded-sm ${sizes[size]} ${
                isPC ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/5" : "border-blue-500/60 text-blue-300 bg-blue-500/5"
            }`}
        >
            <Icon className={ic} /> {platform}
        </span>
    );
}
