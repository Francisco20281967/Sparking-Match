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


# ===== Matchmaking (REST + WebSocket) =====
class MMConnection:
    def __init__(self, user: dict, ws: WebSocket):
        self.user = user
        self.ws = ws
        self.match_id: Optional[str] = None


# In-memory state
queues: Dict[str, List[str]] = {"PC": [], "PS5": []}  # platform -> list of user_ids
queued_users: set = set()  # user_ids currently queued
connections: Dict[str, MMConnection] = {}  # user_id -> MMConnection (WS clients only)
active_matches: Dict[str, dict] = {}  # match_id -> match state
user_match: Dict[str, str] = {}  # user_id -> match_id
last_seen: Dict[str, datetime] = {}  # user_id -> last activity (for "online" count via REST polling)
mm_lock = asyncio.Lock()


async def _send(conn: MMConnection, msg: dict):
    try:
        await conn.ws.send_json(msg)
    except Exception as e:
        logger.warning(f"send failed: {e}")


async def _broadcast(match_id: str, msg: dict):
    """Send a WS message to any WS-connected players in the match (REST clients ignore)."""
    state = active_matches.get(match_id)
    if not state:
        return
    for uid in state["players"]:
        c = connections.get(uid)
        if c:
            await _send(c, msg)


def _public_player(u: dict) -> dict:
    return serialize_user(u)


async def _start_match(uid1: str, uid2: str):
    u1 = await db.users.find_one({"_id": uid1})
    u2 = await db.users.find_one({"_id": uid2})
    if not u1 or not u2:
        return
    match_id = str(uuid.uuid4())
    state = {
        "id": match_id,
        "players": [uid1, uid2],
        "user_objects": {uid1: u1, uid2: u2},
        "accepts": set(),
        "rejects": set(),
        "rematches": set(),
        "scores": {uid1: 0, uid2: 0},
        "rounds": [],
        "status": "pending",  # pending -> in_progress -> finished/rejected
        "set_winner_id": None,
        "points_delta": {uid1: 0, uid2: 0},
        "pending_reports": {},
        "created_at": iso(now_utc()),
    }
    active_matches[match_id] = state
    user_match[uid1] = match_id
    user_match[uid2] = match_id
    # Optional WS notify
    c1 = connections.get(uid1)
    c2 = connections.get(uid2)
    if c1:
        c1.match_id = match_id
        await _send(c1, {"type": "match_found", "match_id": match_id, "opponent": _public_player(u2)})
    if c2:
        c2.match_id = match_id
        await _send(c2, {"type": "match_found", "match_id": match_id, "opponent": _public_player(u1)})


async def _try_pair(platform: str):
    q = queues[platform]
    while len(q) >= 2:
        u1 = q.pop(0)
        u2 = q.pop(0)
        queued_users.discard(u1)
        queued_users.discard(u2)
        await _start_match(u1, u2)


async def _finalize_set(match_id: str):
    state = active_matches.get(match_id)
    if not state or state["status"] == "finished":
        return
    p1, p2 = state["players"]
    s1 = state["scores"][p1]
    s2 = state["scores"][p2]
    state["status"] = "finished"
    state["finished_at"] = iso(now_utc())

    async def apply(uid: str, wins: int, losses: int, set_won: bool):
        u = await db.users.find_one({"_id": uid})
        if not u:
            return 0
        streak = u.get("win_streak", 0)
        total = 0
        for _ in range(wins):
            mult = get_multiplier(streak)
            total += int(3 * mult + 0.5)
            streak += 1
        for i in range(losses):
            total -= 1
            if i == 0:
                streak = 0
        new_points = max(0, u.get("points", 0) + total)
        best_streak = max(u.get("best_streak", 0), streak)
        await db.users.update_one({"_id": uid}, {"$set": {
            "points": new_points,
            "win_streak": streak,
            "best_streak": best_streak,
            "total_wins": u.get("total_wins", 0) + wins,
            "total_losses": u.get("total_losses", 0) + losses,
            "sets_won": u.get("sets_won", 0) + (1 if set_won else 0),
            "sets_lost": u.get("sets_lost", 0) + (0 if set_won else 1),
        }})
        if u.get("team_id"):
            await db.teams.update_one({"_id": u["team_id"]}, {"$inc": {"total_points": new_points - u.get("points", 0)}})
        return total

    p1_won = s1 > s2
    p2_won = s2 > s1
    delta1 = await apply(p1, s1, s2, p1_won)
    delta2 = await apply(p2, s2, s1, p2_won)
    state["points_delta"] = {p1: delta1, p2: delta2}
    state["set_winner_id"] = p1 if p1_won else (p2 if p2_won else None)

    await db.matches.insert_one({
        "_id": match_id,
        "players": state["players"],
        "scores": state["scores"],
        "rounds": state["rounds"],
        "status": "finished",
        "created_at": state["created_at"],
        "finished_at": state["finished_at"],
    })

    # WS notify
    for uid in state["players"]:
        c = connections.get(uid)
        if c:
            u = await db.users.find_one({"_id": uid})
            await _send(c, {
                "type": "set_finished",
                "match_id": match_id,
                "scores": state["scores"],
                "winner_id": state["set_winner_id"],
                "points_delta": delta1 if uid == p1 else delta2,
                "user": serialize_user(u, include_private=True),
            })


def _user_state(uid: str, current_user: dict) -> dict:
    """Compute the full match state for a single user (REST polling response)."""
    out = {
        "status": "idle",
        "match_id": None,
        "opponent": None,
        "scores": {},
        "rounds": [],
        "i_accepted": False,
        "opponent_accepted": False,
        "i_want_rematch": False,
        "opponent_wants_rematch": False,
        "set_winner_id": None,
        "points_delta": 0,
        "pending_round_report": False,
        "online": len(last_seen),
        "queue_pc": len(queues["PC"]),
        "queue_ps5": len(queues["PS5"]),
    }
    if uid in queued_users:
        out["status"] = "queued"
        return out
    mid = user_match.get(uid)
    if not mid or mid not in active_matches:
        return out
    m = active_matches[mid]
    opp_id = next((p for p in m["players"] if p != uid), None)
    out["match_id"] = mid
    out["opponent"] = serialize_user(m["user_objects"].get(opp_id)) if opp_id else None
    out["scores"] = {pid: m["scores"].get(pid, 0) for pid in m["players"]}
    out["rounds"] = list(m["rounds"])
    out["i_accepted"] = uid in m["accepts"]
    out["opponent_accepted"] = (opp_id in m["accepts"]) if opp_id else False
    out["i_want_rematch"] = uid in m["rematches"]
    out["opponent_wants_rematch"] = (opp_id in m["rematches"]) if opp_id else False
    out["set_winner_id"] = m.get("set_winner_id")
    pd = m.get("points_delta", {})
    out["points_delta"] = pd.get(uid, 0)
    out["pending_round_report"] = uid in m.get("pending_reports", {})
    if m["status"] == "pending":
        out["status"] = "match_found"
    elif m["status"] == "in_progress":
        out["status"] = "in_progress"
    elif m["status"] == "finished":
        out["status"] = "finished"
    elif m["status"] == "rejected":
        out["status"] = "rejected"
    return out


# Pydantic for round report
class RoundIn(BaseModel):
    winner_id: str


# ===== REST endpoints (preferred by frontend) =====
@api.get("/match/state")
async def match_state(user: dict = Depends(get_current_user)):
    last_seen[user["_id"]] = now_utc()
    # Cleanup last_seen older than 30s
    cutoff = now_utc() - timedelta(seconds=30)
    stale = [uid for uid, ts in last_seen.items() if ts < cutoff]
    for uid in stale:
        last_seen.pop(uid, None)
    return _user_state(user["_id"], user)


@api.post("/match/queue")
async def match_queue(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    async with mm_lock:
        # already in active match
        mid = user_match.get(uid)
        if mid and mid in active_matches and active_matches[mid]["status"] != "finished":
            return _user_state(uid, user)
        # already finished match - clear it
        if mid and mid in active_matches and active_matches[mid]["status"] == "finished":
            # don't auto-leave; require explicit /match/leave or /match/rematch
            pass
        platform = user.get("platform", "PC")
        if platform not in queues:
            platform = "PC"
        # remove duplicates
        queues[platform] = [u for u in queues[platform] if u != uid]
        queues[platform].append(uid)
        queued_users.add(uid)
        await _try_pair(platform)
    return _user_state(uid, user)


@api.post("/match/dequeue")
async def match_dequeue(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    async with mm_lock:
        for p in queues:
            queues[p] = [u for u in queues[p] if u != uid]
        queued_users.discard(uid)
    return _user_state(uid, user)


@api.post("/match/accept")
async def match_accept(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    mid = user_match.get(uid)
    if not mid or mid not in active_matches:
        raise HTTPException(status_code=404, detail="No hay match activo")
    m = active_matches[mid]
    if m["status"] not in ("pending", "in_progress"):
        raise HTTPException(status_code=400, detail="El match no está disponible")
    m["accepts"].add(uid)
    if len(m["accepts"]) == 2 and m["status"] == "pending":
        m["status"] = "in_progress"
    return _user_state(uid, user)


@api.post("/match/reject")
async def match_reject(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    mid = user_match.get(uid)
    if not mid or mid not in active_matches:
        return _user_state(uid, user)
    m = active_matches[mid]
    if m["status"] == "finished":
        return _user_state(uid, user)
    m["status"] = "rejected"
    for pid in m["players"]:
        if user_match.get(pid) == mid:
            user_match.pop(pid, None)
    # delete match record
    active_matches.pop(mid, None)
    return _user_state(uid, user)


@api.post("/match/round")
async def match_round(data: RoundIn, user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    mid = user_match.get(uid)
    if not mid or mid not in active_matches:
        raise HTTPException(status_code=404, detail="No hay match activo")
    m = active_matches[mid]
    if m["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Match no en curso")
    if data.winner_id not in m["players"]:
        raise HTTPException(status_code=400, detail="Ganador inválido")
    pending = m.setdefault("pending_reports", {})
    pending[uid] = data.winner_id
    if len(pending) == 2:
        if len(set(pending.values())) == 1:
            w = next(iter(set(pending.values())))
            m["rounds"].append({"winner_id": w})
            m["scores"][w] = m["scores"].get(w, 0) + 1
            m["pending_reports"] = {}
            p1, p2 = m["players"]
            ended = m["scores"][p1] >= 2 or m["scores"][p2] >= 2 or len(m["rounds"]) >= 3
            if ended:
                await _finalize_set(mid)
        else:
            # disagreement: clear and ask again
            m["pending_reports"] = {}
            m["disagreement_at"] = iso(now_utc())
    return _user_state(uid, user)


@api.post("/match/rematch")
async def match_rematch(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    mid = user_match.get(uid)
    if not mid or mid not in active_matches:
        raise HTTPException(status_code=404, detail="Sin match")
    m = active_matches[mid]
    if m["status"] != "finished":
        raise HTTPException(status_code=400, detail="El set aún no ha finalizado")
    m["rematches"].add(uid)
    if len(m["rematches"]) == 2:
        p1, p2 = m["players"]
        active_matches.pop(mid, None)
        user_match.pop(p1, None)
        user_match.pop(p2, None)
        await _start_match(p1, p2)
    return _user_state(uid, user)


@api.post("/match/leave")
async def match_leave(user: dict = Depends(get_current_user)):
    uid = user["_id"]
    last_seen[uid] = now_utc()
    mid = user_match.get(uid)
    if mid and mid in active_matches:
        m = active_matches[mid]
        if m["status"] == "finished":
            user_match.pop(uid, None)
            # if both left, clean up
            other = next((p for p in m["players"] if p != uid), None)
            if other and user_match.get(other) != mid:
                active_matches.pop(mid, None)
        else:
            # abort match for everyone
            for pid in m["players"]:
                user_match.pop(pid, None)
            active_matches.pop(mid, None)
    # also leave queue
    for p in queues:
        queues[p] = [u for u in queues[p] if u != uid]
    queued_users.discard(uid)
    return _user_state(uid, user)


# ===== WebSocket (legacy / power users) =====
async def _handle_message(conn: MMConnection, msg: dict):
    msg_type = msg.get("type")
    uid = conn.user["_id"]

    if msg_type == "join_queue":
        async with mm_lock:
            platform = conn.user.get("platform", "PC")
            if platform not in queues:
                platform = "PC"
            queues[platform] = [u for u in queues[platform] if u != uid]
            queues[platform].append(uid)
            queued_users.add(uid)
            await _send(conn, {"type": "queued", "platform": platform, "position": len(queues[platform])})
            await _try_pair(platform)
        return

    if msg_type == "leave_queue":
        async with mm_lock:
            for p in queues:
                queues[p] = [u for u in queues[p] if u != uid]
            queued_users.discard(uid)
            await _send(conn, {"type": "queue_left"})
        return

    if msg_type == "accept":
        mid = msg.get("match_id") or conn.match_id or user_match.get(uid)
        m = active_matches.get(mid)
        if not m or uid not in m["players"]:
            return
        m["accepts"].add(uid)
        if len(m["accepts"]) == 2:
            m["status"] = "in_progress"
            await _broadcast(mid, {"type": "match_started", "match_id": mid})
        else:
            for pid in m["players"]:
                if pid != uid:
                    c = connections.get(pid)
                    if c:
                        await _send(c, {"type": "opponent_accepted", "match_id": mid})
        return

    if msg_type == "reject":
        mid = msg.get("match_id") or conn.match_id or user_match.get(uid)
        m = active_matches.get(mid)
        if not m:
            return
        m["status"] = "rejected"
        await _broadcast(mid, {"type": "match_rejected", "match_id": mid, "by": uid})
        for pid in m["players"]:
            user_match.pop(pid, None)
            c = connections.get(pid)
            if c:
                c.match_id = None
        active_matches.pop(mid, None)
        return

    if msg_type == "report_round":
        mid = msg.get("match_id") or conn.match_id or user_match.get(uid)
        winner_id = msg.get("winner_id")
        m = active_matches.get(mid)
        if not m or m["status"] != "in_progress":
            return
        if winner_id not in m["players"]:
            return
        pending = m.setdefault("pending_reports", {})
        pending[uid] = winner_id
        if len(pending) == 2:
            if len(set(pending.values())) == 1:
                w = next(iter(set(pending.values())))
                m["rounds"].append({"winner_id": w})
                m["scores"][w] = m["scores"].get(w, 0) + 1
                m["pending_reports"] = {}
                p1, p2 = m["players"]
                ended = m["scores"][p1] >= 2 or m["scores"][p2] >= 2 or len(m["rounds"]) >= 3
                await _broadcast(mid, {
                    "type": "round_recorded",
                    "match_id": mid,
                    "winner_id": w,
                    "scores": m["scores"],
                    "round": len(m["rounds"]),
                })
                if ended:
                    await _finalize_set(mid)
            else:
                m["pending_reports"] = {}
                await _broadcast(mid, {"type": "round_disagreement", "match_id": mid})
        else:
            await _send(conn, {"type": "round_pending", "match_id": mid})
        return

    if msg_type == "rematch":
        mid = msg.get("match_id") or conn.match_id or user_match.get(uid)
        m = active_matches.get(mid)
        if not m or m["status"] != "finished":
            return
        m["rematches"].add(uid)
        if len(m["rematches"]) == 2:
            p1, p2 = m["players"]
            active_matches.pop(mid, None)
            user_match.pop(p1, None)
            user_match.pop(p2, None)
            await _start_match(p1, p2)
        else:
            for pid in m["players"]:
                if pid != uid:
                    c = connections.get(pid)
                    if c:
                        await _send(c, {"type": "opponent_wants_rematch", "match_id": mid})
        return

    if msg_type == "leave_match":
        mid = msg.get("match_id") or conn.match_id or user_match.get(uid)
        m = active_matches.get(mid)
        if m:
            for pid in m["players"]:
                user_match.pop(pid, None)
                c = connections.get(pid)
                if c:
                    if pid != uid:
                        await _send(c, {"type": "opponent_left", "match_id": mid})
                    c.match_id = None
            active_matches.pop(mid, None)
        return


@app.websocket("/api/ws/matchmaking")
async def matchmaking_ws(ws: WebSocket):
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
        async with mm_lock:
            for p in queues:
                queues[p] = [u for u in queues[p] if u != user["_id"]]
            queued_users.discard(user["_id"])
        if connections.get(user["_id"]) is conn:
            connections.pop(user["_id"], None)
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
    return {"message": "Sparking Zero API", "online": len(last_seen) + len(connections)}


@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    last_seen[user["_id"]] = now_utc()
    return {
        "online": len(set(list(last_seen.keys()) + list(connections.keys()))),
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
