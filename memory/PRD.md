# Sparking Zone — PRD

## Original Problem Statement
Web de matchmaking para Dragon Ball Sparking Zero. Cuenta con nombre de luchador + contraseña, perfil con avatar ajustable, país, equipo y plataforma. Botón de matchmaking que empareja en tiempo real, marcador para sets de máximo 3 partidas con revanchas y rechazo, +3 pts/win, -1 pt/loss, multiplicador de racha x1→x10, 5 rangos (Guerrero clase baja/media/alta, Dios, Leyenda), historial con conteo de peleas vs mismo rival, cambio de nombre cada 2 semanas, equipos (crear/unirse/leaderboard), eliminar cuenta con limpieza, plataforma PC/PS5, sección amigos y rivales con perfil completo.

## Architecture
- Backend: FastAPI single-file (`/app/backend/server.py`) + Motor (MongoDB) + WebSockets
- Frontend: React 19 + react-router 7 + Tailwind + shadcn/ui + sonner
- Real-time matchmaking: in-process WebSocket queues per platform with accept/reject/round reporting/rematch

## User Personas
- **Competitive ranked player**: quiere subir en clasificación individual y de equipos
- **Casual rivalrist**: marca rivales, sigue su historial y win rate
- **Team captain**: forja equipo, gestiona miembros y tabla por equipos
- **Cross-platform user**: PS5 vs PC, filtra leaderboard por plataforma

## Core Requirements (static)
- Custom JWT auth (cookie + Bearer) con `fighter_name + password`
- Avatar base64 con ajuste/zoom (canvas)
- WebSocket matchmaking: cola → match_found → accept/reject → reportar rondas → set_finished → rematch
- Sistema de puntos: +3*mult por win, -1 por loss, racha cap x10, half-up rounding
- 5 rangos por puntos (0-49, 50-149, 150-249, 250-499, 500+)
- Cambio de nombre con bloqueo de 14 días
- Equipos con nombre + descripción + logo (base64), join/leave, leaderboard agregado
- Amigos y rivales (upsert por owner+target), search, perfil completo de otros usuarios
- Account deletion cascada (equipo, friendships, matches)

## Implemented (2026-02)
- [x] Auth (register/login/me/logout/delete) con JWT cookie + token JSON
- [x] Profile (avatar base64 con zoom/drag, country, platform, fighter-name change)
- [x] WebSocket matchmaking completo (best of 3, accept, reject, rematch, leave)
- [x] Puntuación con multiplicador racha (x1→x10, half-up rounding) y rangos
- [x] Equipos: crear/listar/detalle/join/leave/auto-cleanup si vacío
- [x] Leaderboard individual + por equipos con filtro PC/PS5
- [x] Amigos y rivales: search, add, remove, ver perfil completo
- [x] Historial con times_fought por oponente
- [x] UI temática Saiyan dark (Rajdhani+Exo 2+Orbitron) con glassmorphism y aura animada

## Backlog
**P1**
- Tracking de victorias por rival ("3-1 vs Vegeta") en historial detallado
- Notificaciones in-app cuando un amigo entra a la cola
- Modo "duelo amistoso" para retar directamente a un amigo

**P2**
- Sistema de logros / misiones diarias
- Replay summary con IA (gemini) para generar narración de la pelea
- Chat in-game antes/después del set
- Exportar perfil/stats a imagen para compartir en redes
- Skin/aura animada de fondo según rango

## Test Credentials
Ver `/app/memory/test_credentials.md`. Tests auto-provision usuarios.

## Known Issues / Notes
- Backend single-process: queues y matches en memoria. Para escalar, mover a Redis pub/sub.
- Account deletion borra también matches involucrados; futuro: anonimizar el id del usuario eliminado.
