import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Upload, Move } from "lucide-react";
import { toast } from "sonner";

/**
 * AvatarUpload: selects an image file, lets user zoom and drag, outputs base64 (square 256x256).
 */
export default function AvatarUpload({ initial, onSave, saving = false }) {
    const fileRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [imageEl, setImageEl] = useState(null);
    const [zoom, setZoom] = useState([1]);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const dragRef = useRef(null);

    useEffect(() => {
        if (!imgSrc) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setImageEl(img);
            setZoom([1]);
            setPos({ x: 0, y: 0 });
        };
        img.src = imgSrc;
    }, [imgSrc]);

    useEffect(() => {
        if (!imageEl || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const size = canvas.width; // 256
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#0E0B16";
        ctx.fillRect(0, 0, size, size);
        const ratio = Math.max(size / imageEl.width, size / imageEl.height);
        const baseW = imageEl.width * ratio;
        const baseH = imageEl.height * ratio;
        const z = zoom[0];
        const w = baseW * z;
        const h = baseH * z;
        const cx = (size - w) / 2 + pos.x;
        const cy = (size - h) / 2 + pos.y;
        ctx.drawImage(imageEl, cx, cy, w, h);
    }, [imageEl, zoom, pos]);

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 6_000_000) {
            toast.error("Imagen demasiado grande (máx 6MB)");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setImgSrc(reader.result);
        reader.readAsDataURL(f);
    };

    const onMouseDown = (e) => {
        const ev = e.touches?.[0] || e;
        dragRef.current = { startX: ev.clientX, startY: ev.clientY, ox: pos.x, oy: pos.y };
    };
    const onMouseMove = (e) => {
        if (!dragRef.current) return;
        const ev = e.touches?.[0] || e;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        setPos({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
    };
    const onMouseUp = () => { dragRef.current = null; };

    const handleSave = () => {
        if (!imageEl || !canvasRef.current) {
            toast.error("Selecciona una imagen primero");
            return;
        }
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
        onSave(dataUrl);
    };

    return (
        <div className="space-y-4" data-testid="avatar-upload">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div
                    ref={containerRef}
                    className="relative w-64 h-64 surface aura-ring overflow-hidden flex-shrink-0 rounded-full"
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onMouseDown}
                    onTouchMove={onMouseMove}
                    onTouchEnd={onMouseUp}
                    style={{ cursor: imageEl ? "grab" : "default" }}
                    data-testid="avatar-canvas-area"
                >
                    {imgSrc ? (
                        <canvas ref={canvasRef} width={256} height={256} className="w-full h-full" />
                    ) : (
                        initial ? (
                            <img src={initial} alt="avatar actual" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs uppercase tracking-widest font-display">
                                Sin imagen
                            </div>
                        )
                    )}
                    {imageEl && (
                        <div className="absolute bottom-2 left-2 text-[10px] uppercase font-display text-ki-gold/80 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-sm">
                            <Move className="w-3 h-3" /> Arrastra para ajustar
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-4 w-full">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFile}
                        data-testid="avatar-file-input"
                    />
                    <Button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="btn-primary w-full"
                        data-testid="avatar-pick-btn"
                    >
                        <Upload className="w-4 h-4 mr-2" /> Elegir imagen
                    </Button>
                    {imageEl && (
                        <div className="space-y-2">
                            <div className="text-xs uppercase font-display tracking-widest text-zinc-400">Zoom</div>
                            <Slider min={1} max={3} step={0.05} value={zoom} onValueChange={setZoom} data-testid="avatar-zoom-slider" />
                        </div>
                    )}
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !imageEl}
                        className="btn-ghost-violet w-full"
                        data-testid="avatar-save-btn"
                    >
                        {saving ? "Guardando..." : "Guardar avatar"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
