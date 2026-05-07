"""Sparking Zero backend tests - covers auth, profile, teams, friends, leaderboards, history, WebSocket matchmaking."""
import os
import json
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://battle-legends-db.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

# Unique test user names per run to avoid clashes
RUN = uuid.uuid4().hex[:6]
U1_NAME = f"TGoku_{RUN}"
U2_NAME = f"TVeg_{RUN}"
U3_NAME = f"TPic_{RUN}"
PWD = "kameha123"

session = requests.Session()


def _register(name: str, platform: str = "PC", pwd: str = PWD):
    r = session.post(f"{BASE_URL}/api/auth/register", json={"fighter_name": name, "password": pwd, "platform": platform})
    return r


def _login(name: str, pwd: str = PWD):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"fighter_name": name, "password": pwd})
    return r


@pytest.fixture(scope="module")
def users():
    """Register 3 fresh users and return their tokens & ids."""
    out = {}
    for name, plat in [(U1_NAME, "PC"), (U2_NAME, "PS5"), (U3_NAME, "PC")]:
        r = _register(name, plat)
        assert r.status_code == 200, f"register failed for {name}: {r.status_code} {r.text}"
        data = r.json()
        out[name] = {"token": data["token"], "id": data["user"]["id"], "user": data["user"], "platform": plat}
    yield out
    # cleanup
    for name, info in out.items():
        try:
            requests.delete(f"{BASE_URL}/api/auth/account", headers={"Authorization": f"Bearer {info['token']}"})
        except Exception:
            pass


def auth_h(info):
    return {"Authorization": f"Bearer {info['token']}"}


# ---- Auth ----
class TestAuth:
    def test_register_invalid_platform(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"fighter_name": f"X_{RUN}", "password": "abcd", "platform": "Xbox"})
        assert r.status_code == 422

    def test_register_duplicate(self, users):
        r = _register(U1_NAME, "PC")
        assert r.status_code == 400

    def test_login_success(self, users):
        r = _login(U1_NAME)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["fighter_name"] == U1_NAME
        # cookie present
        assert "access_token" in r.cookies

    def test_login_invalid(self):
        r = _login(U1_NAME, "wrong")
        assert r.status_code == 401

    def test_me_with_bearer(self, users):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200
        assert r.json()["fighter_name"] == U1_NAME

    def test_me_with_cookie(self, users):
        r = _login(U1_NAME)
        cookies = r.cookies
        r2 = requests.get(f"{BASE_URL}/api/auth/me", cookies=cookies)
        assert r2.status_code == 200

    def test_me_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---- Profile ----
class TestProfile:
    def test_update_profile(self, users):
        info = users[U1_NAME]
        avatar_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII="
        r = requests.put(f"{BASE_URL}/api/users/me/profile", headers=auth_h(info),
                         json={"country": "AR", "platform": "PS5", "avatar": avatar_b64})
        assert r.status_code == 200
        body = r.json()
        assert body["country"] == "AR"
        assert body["platform"] == "PS5"
        # restore PC for matchmaking tests
        requests.put(f"{BASE_URL}/api/users/me/profile", headers=auth_h(info), json={"platform": "PC"})

    def test_fighter_name_change_and_lock(self, users):
        info = users[U3_NAME]
        new_name = f"TPicX_{RUN}"
        r = requests.put(f"{BASE_URL}/api/users/me/fighter-name", headers=auth_h(info), json={"fighter_name": new_name})
        assert r.status_code == 200, r.text
        # second change must fail
        r2 = requests.put(f"{BASE_URL}/api/users/me/fighter-name", headers=auth_h(info), json={"fighter_name": f"TPicY_{RUN}"})
        assert r2.status_code == 400


# ---- Teams ----
class TestTeams:
    team_id = None

    def test_create_team(self, users):
        info = users[U1_NAME]
        r = requests.post(f"{BASE_URL}/api/teams", headers=auth_h(info),
                          json={"name": f"Saiyans_{RUN}", "description": "elite", "logo": None})
        assert r.status_code == 200, r.text
        TestTeams.team_id = r.json()["id"]

    def test_create_team_when_in_team(self, users):
        info = users[U1_NAME]
        r = requests.post(f"{BASE_URL}/api/teams", headers=auth_h(info),
                          json={"name": f"Other_{RUN}", "description": "", "logo": None})
        assert r.status_code == 400

    def test_create_team_duplicate_name(self, users):
        info = users[U2_NAME]
        r = requests.post(f"{BASE_URL}/api/teams", headers=auth_h(info),
                          json={"name": f"Saiyans_{RUN}", "description": "", "logo": None})
        assert r.status_code == 400

    def test_join_team(self, users):
        info = users[U2_NAME]
        r = requests.post(f"{BASE_URL}/api/teams/{TestTeams.team_id}/join", headers=auth_h(info))
        assert r.status_code == 200

    def test_leave_team(self, users):
        info = users[U2_NAME]
        r = requests.post(f"{BASE_URL}/api/teams/leave", headers=auth_h(info))
        assert r.status_code == 200


# ---- Friends ----
class TestFriends:
    def test_add_friend_and_rival(self, users):
        i1 = users[U1_NAME]
        i2_id = users[U2_NAME]["id"]
        r = requests.post(f"{BASE_URL}/api/friends", headers=auth_h(i1), json={"user_id": i2_id, "type": "friend"})
        assert r.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/friends", headers=auth_h(i1), json={"user_id": i2_id, "type": "rival"})
        assert r2.status_code == 200  # upsert

    def test_list_friends(self, users):
        r = requests.get(f"{BASE_URL}/api/friends", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_remove_friend(self, users):
        i2_id = users[U2_NAME]["id"]
        r = requests.delete(f"{BASE_URL}/api/friends/{i2_id}", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200

    def test_search_users(self, users):
        r = requests.get(f"{BASE_URL}/api/users", params={"q": f"tveg_{RUN}"[:6]}, headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200
        ids = [u["id"] for u in r.json()]
        assert users[U1_NAME]["id"] not in ids  # excludes self


# ---- Leaderboard ----
class TestLeaderboard:
    def test_users_lb(self, users):
        r = requests.get(f"{BASE_URL}/api/leaderboard/users", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_users_lb_pc(self, users):
        r = requests.get(f"{BASE_URL}/api/leaderboard/users?platform=PC", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200
        for u in r.json():
            assert u["platform"] == "PC"

    def test_teams_lb(self, users):
        r = requests.get(f"{BASE_URL}/api/leaderboard/teams", headers=auth_h(users[U1_NAME]))
        assert r.status_code == 200


# ---- History ----
class TestHistory:
    def test_history_empty_initially(self, users):
        r = requests.get(f"{BASE_URL}/api/history", headers=auth_h(users[U2_NAME]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- WebSocket matchmaking ----
async def _ws_flow(users):
    # Ensure both users on PC platform
    for name in (U1_NAME, U2_NAME):
        requests.put(f"{BASE_URL}/api/users/me/profile", headers=auth_h(users[name]), json={"platform": "PC"})

    t1 = users[U1_NAME]["token"]
    t2 = users[U2_NAME]["token"]
    u1 = users[U1_NAME]["id"]
    u2 = users[U2_NAME]["id"]

    url1 = f"{WS_BASE}/api/ws/matchmaking?token={t1}"
    url2 = f"{WS_BASE}/api/ws/matchmaking?token={t2}"

    async with websockets.connect(url1) as w1, websockets.connect(url2) as w2:
        # consume 'connected'
        m1 = json.loads(await asyncio.wait_for(w1.recv(), 5))
        m2 = json.loads(await asyncio.wait_for(w2.recv(), 5))
        assert m1["type"] == "connected"
        assert m2["type"] == "connected"

        await w1.send(json.dumps({"type": "join_queue"}))
        await w2.send(json.dumps({"type": "join_queue"}))

        # we expect: queued + match_found  (order may vary)
        async def collect_until(ws, target_type, attempts=10):
            for _ in range(attempts):
                msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
                if msg["type"] == target_type:
                    return msg
            raise AssertionError(f"never got {target_type}")

        mf1 = await collect_until(w1, "match_found")
        mf2 = await collect_until(w2, "match_found")
        match_id = mf1["match_id"]
        assert mf1["opponent"]["id"] == u2
        assert mf2["opponent"]["id"] == u1

        await w1.send(json.dumps({"type": "accept", "match_id": match_id}))
        await w2.send(json.dumps({"type": "accept", "match_id": match_id}))

        ms1 = await collect_until(w1, "match_started")
        ms2 = await collect_until(w2, "match_started")
        assert ms1["match_id"] == match_id

        # round 1: u1 wins (both report u1)
        await w1.send(json.dumps({"type": "report_round", "match_id": match_id, "winner_id": u1}))
        await w2.send(json.dumps({"type": "report_round", "match_id": match_id, "winner_id": u1}))
        rr1 = await collect_until(w1, "round_recorded")
        rr2 = await collect_until(w2, "round_recorded")
        assert rr1["scores"][u1] == 1

        # round 2: u1 wins again -> set finished (best of 3)
        await w1.send(json.dumps({"type": "report_round", "match_id": match_id, "winner_id": u1}))
        await w2.send(json.dumps({"type": "report_round", "match_id": match_id, "winner_id": u1}))
        # we may receive round_recorded then set_finished
        sf1 = await collect_until(w1, "set_finished", attempts=15)
        sf2 = await collect_until(w2, "set_finished", attempts=15)
        assert sf1["match_id"] == match_id
        assert sf1["winner_id"] == u1
        # points: u1 wins 2 rounds: round(3*1) + round(3*1.5) = 3 + 5 = 8
        # u2 loses 2: -2 -> floored to 0 originally 0
        # delta on payload is total_points_change (may be -2 for u2)
        return sf1, sf2


@pytest.mark.timeout(30)
def test_ws_matchmaking_full_flow(users):
    sf1, sf2 = asyncio.run(_ws_flow(users))
    u1 = users[U1_NAME]["id"]
    u2 = users[U2_NAME]["id"]
    # Determine which sf belongs to which player by user payload
    by_id = {sf1["user"]["id"]: sf1, sf2["user"]["id"]: sf2}
    sf_u1 = by_id[u1]
    sf_u2 = by_id[u2]
    # u1 won 2 rounds: expected delta = 3 + 5 = 8
    assert sf_u1["points_delta"] == 8, f"u1 delta {sf_u1['points_delta']} expected 8"
    # u2 lost 2 rounds: expected delta -2 (raw) but final points capped at 0
    assert sf_u2["points_delta"] == -2
    # Verify points persisted
    me1 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_h(users[U1_NAME])).json()
    me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_h(users[U2_NAME])).json()
    assert me1["points"] == 8
    assert me2["points"] == 0
    assert me1["win_streak"] == 2
    assert me1["total_wins"] == 2


# ---- Reject flow ----
async def _ws_reject_flow(users):
    # Need fresh pair so existing match doesn't interfere
    # Use U1 and U3 (both PC)
    requests.put(f"{BASE_URL}/api/users/me/profile", headers=auth_h(users[U3_NAME]), json={"platform": "PC"})
    t1 = users[U1_NAME]["token"]
    t3 = users[U3_NAME]["token"]
    url1 = f"{WS_BASE}/api/ws/matchmaking?token={t1}"
    url3 = f"{WS_BASE}/api/ws/matchmaking?token={t3}"

    async def collect(ws, target_type, attempts=10):
        for _ in range(attempts):
            msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
            if msg["type"] == target_type:
                return msg
        raise AssertionError(f"never got {target_type}")

    async with websockets.connect(url1) as w1, websockets.connect(url3) as w3:
        await asyncio.wait_for(w1.recv(), 5)
        await asyncio.wait_for(w3.recv(), 5)
        await w1.send(json.dumps({"type": "join_queue"}))
        await w3.send(json.dumps({"type": "join_queue"}))
        mf1 = await collect(w1, "match_found")
        mf3 = await collect(w3, "match_found")
        match_id = mf1["match_id"]
        await w1.send(json.dumps({"type": "reject", "match_id": match_id}))
        r1 = await collect(w1, "match_rejected")
        r3 = await collect(w3, "match_rejected")
        assert r1["match_id"] == match_id
        assert r3["match_id"] == match_id


@pytest.mark.timeout(30)
def test_ws_reject(users):
    asyncio.run(_ws_reject_flow(users))


# ---- Account deletion cascade ----
def test_delete_account_cascade():
    # Create new disposable user
    name = f"Dispo_{RUN}"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"fighter_name": name, "password": PWD, "platform": "PC"})
    assert r.status_code == 200
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    # create team
    r2 = requests.post(f"{BASE_URL}/api/teams", headers=h, json={"name": f"Dispo_T_{RUN}", "description": "", "logo": None})
    assert r2.status_code == 200
    # delete
    r3 = requests.delete(f"{BASE_URL}/api/auth/account", headers=h)
    assert r3.status_code == 200
    # me must fail
    r4 = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
    assert r4.status_code == 401
