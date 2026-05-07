"""Sparking Zero Matchmaking Backend"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import asyncio
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator

# ===== Setup =====
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sparking-zero")

app = FastAPI(title="Sparking Zero Matchmaking")
api = APIRouter(prefix="/api")

# ===== Helpers =====

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(minutes=ACCESS_TTL_MIN), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def get_rank(points: int) -> str:
    if points < 50:
        return "Guerrero de clase baja"
    if points < 150:
        return "Guerrero de clase media"
    if points < 250:
        return "Guerrero de clase alta"
    if points < 500:
        return "Dios"
    return "Leyenda"


def get_multiplier(streak: int) -> float:
    # x1, x1.5, x2, x2.5 ... x10
    # 0 wins => x1; each win adds 0.5 up to x10 (cap at 18 streak)
    mult = 1.0 + 0.5 * streak
    return min(mult, 10.0)


def serialize_user(u: dict, include_private: bool = False) -> dict:
    if not u:
        return None
    out = {
        "id": u["_id"],
        "fighter_name": u["fighter_name"],
        "avatar": u.get("avatar"),
        "country": u.get("country"),
        "platform": u.get("platform"),
        "team_id": u.get("team_id"),
        "team_name": u.get("team_name"),
        "points": u.get("points", 0),
        "win_streak": u.get("win_streak", 0),
        "best_streak": u.get("best_streak", 0),
        "total_wins": u.get("total_wins", 0),
        "total_losses": u.get("total_losses", 0),
        "sets_won": u.get("sets_won", 0),
        "sets_lost": u.get("sets_lost", 0),
        "rank": get_rank(u.get("points", 0)),
        "created_at": u.get("created_at"),
    }
    if include_private:
        out["last_name_change_at"] = u.get("last_name_change_at")
    return out


# ===== Auth dependency =====
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TTL_MIN * 60,
        path="/",
    )


# ===== Models =====
class RegisterIn(BaseModel):
    fighter_name: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=4, max_length=64)
    platform: str

    @field_validator("platform")
    @classmethod
    def v_platform(cls, v):
        if v not in ("PC", "PS5"):
            raise ValueError("La plataforma debe ser PC o PS5")
        return v

    @field_validator("fighter_name")
    @classmethod
    def v_name(cls, v):
        v = v.strip()
        if not v.replace("_", "").replace("-", "").replace(" ", "").isalnum():
            raise ValueError("Nombre solo puede contener letras, números, _, - y espacios")
        return v


class LoginIn(BaseModel):
    fighter_name: str
    password: str


class ProfileUpdateIn(BaseModel):
    country: Optional[str] = None
    platform: Optional[str] = None
    avatar: Optional[str] = None


class FighterNameUpdateIn(BaseModel):
    fighter_name: str = Field(min_length=3, max_length=20)


class TeamCreateIn(BaseModel):
    name: str = Field(min_length=3, max_length=24)
    description: str = Field(default="", max_length=240)
    logo: Optional[str] = None


class FriendActionIn(BaseModel):
    user_id: str
    type: str  # 'friend' | 'rival'


# ===== Auth Routes =====
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    name_lower = data.fighter_name.lower()
    existing = await db.users.find_one({"fighter_name_lower": name_lower})
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de luchador ya está en uso")
    uid = str(uuid.uuid4())
    doc = {
        "_id": uid,
        "fighter_name": data.fighter_name,
        "fighter_name_lower": name_lower,
        "password_hash": hash_password(data.password),
        "platform": data.platform,
        "country": None,
        "avatar": None,
        "team_id": None,
        "team_name": None,
        "points": 0,
        "win_streak": 0,
        "best_streak": 0,
        "total_wins": 0,
        "total_losses": 0,
        "sets_won": 0,
        "sets_lost": 0,
        "last_name_change_at": None,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = create_token(uid)
    set_auth_cookie(response, token)
    return {"user": serialize_user(doc, include_private=True), "token": token}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    user = await db.users.find_one({"fighter_name_lower": data.fighter_name.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user["_id"])
    set_auth_cookie(response, token)
    return {"user": serialize_user(user, include_private=True), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user, include_private=True)


@api.delete("/auth/account")
async def delete_account(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    # Remove from team
    if user.get("team_id"):
        await db.teams.update_one({"_id": user["team_id"]}, {"$pull": {"members": uid}, "$inc": {"total_points": -user.get("points", 0)}})
    # Remove friendship references
    await db.friendships.delete_many({"$or": [{"owner_id": uid}, {"target_id": uid}]})
    # Remove match history references (keep matches but anonymize)
    await db.matches.delete_many({"players": uid})
    await db.users.delete_one({"_id": uid})
    return {"ok": True}


# ===== User / Profile Routes =====
@api.put("/users/me/profile")
async def update_profile(data: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    update: Dict[str, Any] = {}
    if data.country is not None:
        update["country"] = data.country
    if data.platform is not None:
        if data.platform not in ("PC", "PS5"):
            raise HTTPException(status_code=400, detail="Plataforma inválida")
        update["platform"] = data.platform
    if data.avatar is not None:
        if len(data.avatar) > 1_500_000:
            raise HTTPException(status_code=400, detail="Avatar demasiado grande")
        update["avatar"] = data.avatar
    if update:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    new_user = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(new_user, include_private=True)


@api.put("/users/me/fighter-name")
async def change_fighter_name(data: FighterNameUpdateIn, user: dict = Depends(get_current_user)):
    last = user.get("last_name_change_at")
    if last:
        last_dt = datetime.fromisoformat(last) if isinstance(last, str) else last
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if now_utc() - last_dt < timedelta(days=14):
            remaining = timedelta(days=14) - (now_utc() - last_dt)
            days = remaining.days
            hours = remaining.seconds // 3600
            raise HTTPException(status_code=400, detail=f"Debes esperar {days}d {hours}h para volver a cambiar tu nombre")
    new_name = data.fighter_name.strip()
    name_lower = new_name.lower()
    if name_lower != user["fighter_name_lower"]:
        existing = await db.users.find_one({"fighter_name_lower": name_lower})
        if existing:
            raise HTTPException(status_code=400, detail="El nombre ya está en uso")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"fighter_name": new_name, "fighter_name_lower": name_lower, "last_name_change_at": iso(now_utc())}},
    )
    new_user = await db.users.find_one({"_id": user["_id"]})
    return serialize_user(new_user, include_private=True)


@api.get("/users/{user_id}")
async def get_user(user_id: str, current: dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return serialize_user(u, include_private=False)


@api.get("/users")
async def search_users(q: str = "", current: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    users = await db.users.find(
        {"fighter_name_lower": {"$regex": q.lower()}}, {"password_hash": 0}
    ).limit(20).to_list(20)
    return [serialize_user(u) for u in users if u["_id"] != current["_id"]]


@api.get("/leaderboard/users")
async def leaderboard_users(platform: Optional[str] = None, current: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if platform in ("PC", "PS5"):
        q["platform"] = platform
    users = await db.users.find(q, {"password_hash": 0}).sort("points", -1).limit(100).to_list(100)
    return [serialize_user(u) for u in users]


@api.get("/leaderboard/teams")
async def leaderboard_teams(platform: Optional[str] = None, current: dict = Depends(get_current_user)):
    teams = await db.teams.find({}, {"_id": 1, "name": 1, "description": 1, "logo": 1, "total_points": 1, "members": 1, "platform_filter": 1, "created_at": 1}).sort("total_points", -1).limit(100).to_list(100)
    out = []
    for t in teams:
        members_ids = t.get("members", [])
        member_users = await db.users.find({"_id": {"$in": members_ids}}, {"password_hash": 0}).to_list(200)
        if platform in ("PC", "PS5"):
            filtered = [m for m in member_users if m.get("platform") == platform]
            total_pts = sum(m.get("points", 0) for m in filtered)
        else:
            filtered = member_users
            total_pts = sum(m.get("points", 0) for m in member_users)
        out.append({
            "id": t["_id"],
            "name": t["name"],
            "description": t.get("description", ""),
            "logo": t.get("logo"),
            "total_points": total_pts,
            "member_count": len(filtered),
            "created_at": t.get("created_at"),
        })
    out.sort(key=lambda x: x["total_points"], reverse=True)
    return out


# ===== Teams =====
@api.post("/teams")
async def create_team(data: TeamCreateIn, user: dict = Depends(get_current_user)):
    if user.get("team_id"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un equipo")
    name_lower = data.name.lower()
    existing = await db.teams.find_one({"name_lower": name_lower})
    if existing:
        raise HTTPException(status_code=400, detail="Ese nombre de equipo ya existe")
    tid = str(uuid.uuid4())
    if data.logo and len(data.logo) > 800_000:
        raise HTTPException(status_code=400, detail="Logo demasiado grande")
    doc = {
        "_id": tid,
        "name": data.name,
        "name_lower": name_lower,
        "description": data.description,
        "logo": data.logo,
        "owner_id": user["_id"],
        "members": [user["_id"]],
        "total_points": user.get("points", 0),
        "created_at": iso(now_utc()),
    }
    await db.teams.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"team_id": tid, "team_name": data.name}})
    return {
        "id": tid,
        "name": doc["name"],
        "description": doc["description"],
        "logo": doc["logo"],
        "owner_id": doc["owner_id"],
        "members": doc["members"],
        "total_points": doc["total_points"],
        "created_at": doc["created_at"],
    }


@api.get("/teams")
async def list_teams(current: dict = Depends(get_current_user)):
    teams = await db.teams.find({}).sort("total_points", -1).limit(100).to_list(100)
    return [
        {
            "id": t["_id"],
            "name": t["name"],
            "description": t.get("description", ""),
            "logo": t.get("logo"),
            "owner_id": t["owner_id"],
            "member_count": len(t.get("members", [])),
            "total_points": t.get("total_points", 0),
            "created_at": t.get("created_at"),
        }
        for t in teams
    ]


@api.get("/teams/{team_id}")
async def get_team(team_id: str, current: dict = Depends(get_current_user)):
    t = await db.teams.find_one({"_id": team_id})
    if not t:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    members = await db.users.find({"_id": {"$in": t.get("members", [])}}, {"password_hash": 0}).to_list(200)
    return {
        "id": t["_id"],
        "name": t["name"],
        "description": t.get("description", ""),
        "logo": t.get("logo"),
        "owner_id": t["owner_id"],
        "members": [serialize_user(m) for m in members],
        "total_points": t.get("total_points", 0),
        "created_at": t.get("created_at"),
    }


@api.post("/teams/{team_id}/join")
async def join_team(team_id: str, user: dict = Depends(get_current_user)):
    if user.get("team_id"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un equipo. Sal primero.")
    t = await db.teams.find_one({"_id": team_id})
    if not t:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    await db.teams.update_one({"_id": team_id}, {"$addToSet": {"members": user["_id"]}, "$inc": {"total_points": user.get("points", 0)}})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"team_id": team_id, "team_name": t["name"]}})
    return {"ok": True}


@api.post("/teams/leave")
async def leave_team(user: dict = Depends(get_current_user)):
    tid = user.get("team_id")
    if not tid:
        raise HTTPException(status_code=400, detail="No perteneces a ningún equipo")
    t = await db.teams.find_one({"_id": tid})
    if t:
        await db.teams.update_one({"_id": tid}, {"$pull": {"members": user["_id"]}, "$inc": {"total_points": -user.get("points", 0)}})
        # If team is empty, delete it
        new_t = await db.teams.find_one({"_id": tid})
        if new_t and not new_t.get("members"):
            await db.teams.delete_one({"_id": tid})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"team_id": None, "team_name": None}})
    return {"ok": True}


# ===== Friends / Rivals =====
@api.get("/friends")
async def get_friends(user: dict = Depends(get_current_user)):
    rels = await db.friendships.find({"owner_id": user["_id"]}).to_list(500)
    target_ids = [r["target_id"] for r in rels]
    targets = await db.users.find({"_id": {"$in": target_ids}}, {"password_hash": 0}).to_list(500)
    targets_by_id = {t["_id"]: t for t in targets}
    out = []
    for r in rels:
        t = targets_by_id.get(r["target_id"])
        if t:
            out.append({**serialize_user(t), "relation_type": r["type"]})
    return out


@api.post("/friends")
async def add_friend(data: FriendActionIn, user: dict = Depends(get_current_user)):
    if data.user_id == user["_id"]:
        raise HTTPException(status_code=400, detail="No puedes añadirte a ti mismo")
    if data.type not in ("friend", "rival"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    target = await db.users.find_one({"_id": data.user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.friendships.update_one(
        {"owner_id": user["_id"], "target_id": data.user_id},
        {"$set": {"owner_id": user["_id"], "target_id": data.user_id, "type": data.type, "created_at": iso(now_utc())}},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/friends/{target_id}")
async def remove_friend(target_id: str, user: dict = Depends(get_current_user)):
    await db.friendships.delete_one({"owner_id": user["_id"], "target_id": target_id})
    return {"ok": True}


# ===== Match History =====
@api.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    matches = await db.matches.find({"players": user["_id"], "status": "finished"}).sort("finished_at", -1).limit(100).to_list(100)
    # opponent counts
    opponent_counts: Dict[str, int] = {}
    for m in matches:
        opp = next((p for p in m["players"] if p != user["_id"]), None)
        if opp:
            opponent_counts[opp] = opponent_counts.get(opp, 0) + 1
    opp_users = await db.users.find({"_id": {"$in": list(opponent_counts.keys())}}, {"password_hash": 0}).to_list(200)
    opp_map = {u["_id"]: serialize_user(u) for u in opp_users}
    out = []
    for m in matches:
        opp = next((p for p in m["players"] if p != user["_id"]), None)
        my_score = m["scores"].get(user["_id"], 0)
        opp_score = m["scores"].get(opp, 0) if opp else 0
        out.append({
            "id": m["_id"],
            "opponent": opp_map.get(opp) if opp else None,
            "times_fought": opponent_counts.get(opp, 1) if opp else 1,
            "my_score": my_score,
            "opp_score": opp_score,
            "result": "win" if my_score > opp_score else ("loss" if my_score < opp_score else "draw"),
            "rounds": m.get("rounds", []),
            "finished_at": m.get("finished_at"),
        })
    return out


# ===== Matchmaking WebSocket =====
class MMConnection:
    def __init__(self, user: dict, ws: WebSocket):
        self.user = user
        self.ws = ws
        self.match_id: Optional[str] = None


# In-memory state (acceptable for single-process, dev usage)
queues: Dict[str, List[MMConnection]] = {"PC": [], "PS5": []}
connections: Dict[str, MMConnection] = {}  # user_id -> MMConnection
active_matches: Dict[str, dict] = {}  # match_id -> match state in memory
mm_lock = asyncio.Lock()


async def _send(conn: MMConnection, msg: dict):
    try:
        await conn.ws.send_json(msg)
    except Exception as e:
        logger.warning(f"send failed: {e}")


def _public_player(u: dict) -> dict:
    return serialize_user(u)


async def _start_match(p1: MMConnection, p2: MMConnection):
    match_id = str(uuid.uuid4())
    state = {
        "id": match_id,
        "players": [p1.user["_id"], p2.user["_id"]],
        "user_objects": {p1.user["_id"]: p1.user, p2.user["_id"]: p2.user},
        "accepts": set(),
        "rejects": set(),
        "rematches": set(),
        "scores": {p1.user["_id"]: 0, p2.user["_id"]: 0},
        "rounds": [],  # list of {winner_id}
        "status": "pending",  # pending->accepted->in_progress->finished
        "created_at": iso(now_utc()),
    }
    active_matches[match_id] = state
    p1.match_id = match_id
    p2.match_id = match_id
    await _send(p1, {"type": "match_found", "match_id": match_id, "opponent": _public_player(p2.user)})
    await _send(p2, {"type": "match_found", "match_id": match_id, "opponent": _public_player(p1.user)})


async def _try_pair(platform: str):
    q = queues[platform]
    while len(q) >= 2:
        p1 = q.pop(0)
        p2 = q.pop(0)
        await _start_match(p1, p2)


async def _finalize_set(match_id: str):
    """Apply points based on final set score."""
    state = active_matches.get(match_id)
    if not state or state["status"] == "finished":
        return
    p1, p2 = state["players"]
    s1 = state["scores"][p1]
    s2 = state["scores"][p2]
    state["status"] = "finished"
    state["finished_at"] = iso(now_utc())

    # Apply points per round won/lost (each individual match)
    # For each player: wins = scores; losses = opponent_scores
    async def apply(uid: str, wins: int, losses: int, set_won: bool):
        u = await db.users.find_one({"_id": uid})
        if not u:
            return 0
        streak = u.get("win_streak", 0)
        total_points_change = 0
        # apply each win sequentially using current streak multiplier
        for _ in range(wins):
            mult = get_multiplier(streak)
            total_points_change += int(round(3 * mult))
            streak += 1
        # losses: -1 each, reset streak after first loss
        for i in range(losses):
            total_points_change -= 1
            if i == 0:
                streak = 0
        new_points = max(0, u.get("points", 0) + total_points_change)
        best_streak = max(u.get("best_streak", 0), streak)
        update = {
            "points": new_points,
            "win_streak": streak,
            "best_streak": best_streak,
            "total_wins": u.get("total_wins", 0) + wins,
            "total_losses": u.get("total_losses", 0) + losses,
            "sets_won": u.get("sets_won", 0) + (1 if set_won else 0),
            "sets_lost": u.get("sets_lost", 0) + (0 if set_won else 1),
        }
        await db.users.update_one({"_id": uid}, {"$set": update})
        # Update team total_points
        if u.get("team_id"):
            await db.teams.update_one({"_id": u["team_id"]}, {"$inc": {"total_points": new_points - u.get("points", 0)}})
        return total_points_change

    p1_won = s1 > s2
    p2_won = s2 > s1
    delta1 = await apply(p1, s1, s2, p1_won)
    delta2 = await apply(p2, s2, s1, p2_won)

    # Persist match
    await db.matches.insert_one({
        "_id": match_id,
        "players": state["players"],
        "scores": state["scores"],
        "rounds": state["rounds"],
        "status": "finished",
        "created_at": state["created_at"],
        "finished_at": state["finished_at"],
    })

    # Notify both
    for uid in state["players"]:
        conn = connections.get(uid)
        if conn:
            u = await db.users.find_one({"_id": uid})
            await _send(conn, {
                "type": "set_finished",
                "match_id": match_id,
                "scores": state["scores"],
                "winner_id": p1 if p1_won else (p2 if p2_won else None),
                "points_delta": delta1 if uid == p1 else delta2,
                "user": serialize_user(u, include_private=True),
            })


async def _handle_message(conn: MMConnection, msg: dict):
    msg_type = msg.get("type")

    if msg_type == "join_queue":
        async with mm_lock:
            platform = conn.user.get("platform", "PC")
            if platform not in queues:
                platform = "PC"
            # Avoid duplicates
            queues[platform] = [c for c in queues[platform] if c.user["_id"] != conn.user["_id"]]
            queues[platform].append(conn)
            await _send(conn, {"type": "queued", "platform": platform, "position": len(queues[platform])})
            await _try_pair(platform)
        return

    if msg_type == "leave_queue":
        async with mm_lock:
            for p, q in queues.items():
                queues[p] = [c for c in q if c.user["_id"] != conn.user["_id"]]
            await _send(conn, {"type": "queue_left"})
        return

    if msg_type == "accept":
        match_id = msg.get("match_id") or conn.match_id
        state = active_matches.get(match_id)
        if not state or conn.user["_id"] not in state["players"]:
            return
        state["accepts"].add(conn.user["_id"])
        if len(state["accepts"]) == 2:
            state["status"] = "in_progress"
            for uid in state["players"]:
                c = connections.get(uid)
                if c:
                    await _send(c, {"type": "match_started", "match_id": match_id})
        else:
            # notify other that opponent accepted
            for uid in state["players"]:
                if uid != conn.user["_id"]:
                    c = connections.get(uid)
                    if c:
                        await _send(c, {"type": "opponent_accepted", "match_id": match_id})
        return

    if msg_type == "reject":
        match_id = msg.get("match_id") or conn.match_id
        state = active_matches.get(match_id)
        if not state:
            return
        state["status"] = "rejected"
        for uid in state["players"]:
            c = connections.get(uid)
            if c:
                await _send(c, {"type": "match_rejected", "match_id": match_id, "by": conn.user["_id"]})
                c.match_id = None
        active_matches.pop(match_id, None)
        return

    if msg_type == "report_round":
        # winner_id of a single round
        match_id = msg.get("match_id") or conn.match_id
        winner_id = msg.get("winner_id")
        state = active_matches.get(match_id)
        if not state or state["status"] != "in_progress":
            return
        if winner_id not in state["players"]:
            return
        # Both players must report; we accept first report and treat second as confirmation if matches
        # store pending reports
        pending = state.setdefault("pending_reports", {})
        pending[conn.user["_id"]] = winner_id
        if len(pending) == 2:
            # if both agree, record
            uniq = set(pending.values())
            if len(uniq) == 1:
                w = uniq.pop()
                state["rounds"].append({"winner_id": w})
                state["scores"][w] = state["scores"].get(w, 0) + 1
                state["pending_reports"] = {}
                # check set end: best of 3 (first to 2 OR 3 rounds played)
                p1, p2 = state["players"]
                ended = state["scores"][p1] >= 2 or state["scores"][p2] >= 2 or len(state["rounds"]) >= 3
                for uid in state["players"]:
                    c = connections.get(uid)
                    if c:
                        await _send(c, {
                            "type": "round_recorded",
                            "match_id": match_id,
                            "winner_id": w,
                            "scores": state["scores"],
                            "round": len(state["rounds"]),
                        })
                if ended:
                    await _finalize_set(match_id)
            else:
                # disagreement: clear and ask again
                state["pending_reports"] = {}
                for uid in state["players"]:
                    c = connections.get(uid)
                    if c:
                        await _send(c, {"type": "round_disagreement", "match_id": match_id})
        else:
            # ack
            await _send(conn, {"type": "round_pending", "match_id": match_id})
        return

    if msg_type == "rematch":
        match_id = msg.get("match_id") or conn.match_id
        state = active_matches.get(match_id)
        if not state or state["status"] != "finished":
            return
        state["rematches"].add(conn.user["_id"])
        if len(state["rematches"]) == 2:
            # start a brand new match
            p1_id, p2_id = state["players"]
            c1 = connections.get(p1_id)
            c2 = connections.get(p2_id)
            active_matches.pop(match_id, None)
            if c1 and c2:
                await _start_match(c1, c2)
        else:
            for uid in state["players"]:
                if uid != conn.user["_id"]:
                    c = connections.get(uid)
                    if c:
                        await _send(c, {"type": "opponent_wants_rematch", "match_id": match_id})
        return

    if msg_type == "leave_match":
        match_id = msg.get("match_id") or conn.match_id
        state = active_matches.get(match_id)
        if state:
            for uid in state["players"]:
                c = connections.get(uid)
                if c:
                    await _send(c, {"type": "opponent_left", "match_id": match_id})
                    c.match_id = None
            active_matches.pop(match_id, None)
        return


@app.websocket("/api/ws/matchmaking")
async def matchmaking_ws(ws: WebSocket):
    # Auth via query param 'token'
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4401)
        return
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            await ws.close(code=4401)
            return
    except Exception:
        await ws.close(code=4401)
        return

    await ws.accept()
    conn = MMConnection(user, ws)
    # If existing connection, close it
    old = connections.get(user["_id"])
    if old:
        try:
            await old.ws.close()
        except Exception:
            pass
    connections[user["_id"]] = conn
    await _send(conn, {"type": "connected", "user": serialize_user(user, include_private=True)})

    try:
        while True:
            data = await ws.receive_json()
            await _handle_message(conn, data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"ws error: {e}")
    finally:
        # Cleanup
        async with mm_lock:
            for p, q in queues.items():
                queues[p] = [c for c in q if c.user["_id"] != user["_id"]]
        if connections.get(user["_id"]) is conn:
            connections.pop(user["_id"], None)
        # Notify opponent if in active match
        if conn.match_id and conn.match_id in active_matches:
            state = active_matches[conn.match_id]
            for uid in state["players"]:
                if uid != user["_id"]:
                    c = connections.get(uid)
                    if c:
                        await _send(c, {"type": "opponent_disconnected", "match_id": conn.match_id})


# ===== Health =====
@api.get("/")
async def root():
    return {"message": "Sparking Zero API", "online": len(connections)}


@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    return {
        "online": len(connections),
        "queue_pc": len(queues["PC"]),
        "queue_ps5": len(queues["PS5"]),
    }


# Mount router
app.include_router(api)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("fighter_name_lower", unique=True)
    await db.teams.create_index("name_lower", unique=True)
    await db.matches.create_index([("players", 1)])
    await db.matches.create_index([("finished_at", -1)])
    await db.friendships.create_index([("owner_id", 1), ("target_id", 1)], unique=True)
    logger.info("Startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
