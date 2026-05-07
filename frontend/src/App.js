import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MatchmakingProvider } from "@/contexts/MatchmakingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import MatchmakingDialog from "@/components/MatchmakingDialog";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";
import Leaderboard from "@/pages/Leaderboard";
import Teams from "@/pages/Teams";
import History from "@/pages/History";
import Friends from "@/pages/Friends";

function PublicOnly({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return children;
}

function ShellRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <MatchmakingProvider>
                            <Layout>
                                <Routes>
                                    <Route index element={<Dashboard />} />
                                    <Route path="leaderboard" element={<Leaderboard />} />
                                    <Route path="teams" element={<Teams />} />
                                    <Route path="friends" element={<Friends />} />
                                    <Route path="history" element={<History />} />
                                    <Route path="profile" element={<Profile />} />
                                    <Route path="users/:id" element={<UserProfile />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                            <MatchmakingDialog />
                        </MatchmakingProvider>
                    </ProtectedRoute>
                }
            />
        </Routes>
    );
}

function App() {
    useEffect(() => {
        document.documentElement.classList.add("dark");
    }, []);
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <ShellRoutes />
                </AuthProvider>
            </BrowserRouter>
            <Toaster richColors position="top-right" theme="dark" />
        </div>
    );
}

export default App;
