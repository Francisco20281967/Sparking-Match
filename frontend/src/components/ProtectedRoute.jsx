import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading || user === null) {
        return (
            <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
                <div className="font-display text-ki-gold text-xl tracking-widest animate-pulse">CARGANDO KI...</div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    return children;
}
