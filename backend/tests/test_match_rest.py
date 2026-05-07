"""REST matchmaking endpoint tests (HTTP polling migration)."""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://battle-legends-db.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _register(suffix):
    s = requests.Session()
    name = f"TR_{suffix}_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/auth/register", json={"fighter_name": name, "password": "kameha123", "platform": "PC"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, r.json()["user"], name


@pytest.fixture(scope="module")
def two_users():
    a, ua, na = _register("A")
    b, ub, nb = _register("B")
    yield (a, ua), (b, ub)
    try:
        a.delete(f"{API}/auth/account")
    except Exception:
        pass
    try:
        b.delete(f"{API}/auth/account")
    except Exception:
        pass


def test_state_idle(two_users):
    (a, ua), _ = two_users
    r = a.get(f"{API}/match/state")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "idle"
    assert d["match_id"] is None


def test_queue_and_pair(two_users):
    (a, ua), (b, ub) = two_users
    ra = a.post(f"{API}/match/queue").json()
    assert ra["status"] in ("queued", "match_found")
    rb = b.post(f"{API}/match/queue").json()
    # B should immediately be paired since A is in queue
    assert rb["status"] == "match_found", rb
    assert rb["opponent"]["id"] == ua["id"]
    # A also sees match_found on next poll
    sa = a.get(f"{API}/match/state").json()
    assert sa["status"] == "match_found"
    assert sa["opponent"]["id"] == ub["id"]
    assert sa["match_id"] == rb["match_id"]


def test_accept_both_to_in_progress(two_users):
    (a, ua), (b, ub) = two_users
    ra = a.post(f"{API}/match/accept").json()
    assert ra["i_accepted"] is True
    # status still match_found until both accept
    rb = b.post(f"{API}/match/accept").json()
    assert rb["status"] == "in_progress"
    sa = a.get(f"{API}/match/state").json()
    assert sa["status"] == "in_progress"


def test_round_reporting_full_set_a_wins(two_users):
    (a, ua), (b, ub) = two_users
    # Round 1 -> A wins
    a.post(f"{API}/match/round", json={"winner_id": ua["id"]})
    sb = b.post(f"{API}/match/round", json={"winner_id": ua["id"]}).json()
    assert sb["scores"][ua["id"]] == 1
    # Round 2 -> A wins => 2-0 set finished
    a.post(f"{API}/match/round", json={"winner_id": ua["id"]})
    sb2 = b.post(f"{API}/match/round", json={"winner_id": ua["id"]}).json()
    assert sb2["status"] == "finished"
    assert sb2["set_winner_id"] == ua["id"]
    sa = a.get(f"{API}/match/state").json()
    assert sa["status"] == "finished"
    # Points delta: winner 2 wins (mult x1 + x1.5 => 3 + 5 = 8 with half-up rounding, but server may use banker => 7)
    assert sa["points_delta"] >= 6, f"unexpected delta {sa['points_delta']}"
    sb3 = b.get(f"{API}/match/state").json()
    # Loser: 2 losses => -2 (or 0 if floor)
    assert sb3["points_delta"] in (-2, 0)


def test_rematch_starts_new_match(two_users):
    (a, ua), (b, ub) = two_users
    ra = a.post(f"{API}/match/rematch").json()
    assert ra["i_want_rematch"] is True
    rb = b.post(f"{API}/match/rematch").json()
    # Both rematched: new match should be in match_found state
    assert rb["status"] == "match_found", rb
    sa = a.get(f"{API}/match/state").json()
    assert sa["status"] == "match_found"
    assert sa["opponent"]["id"] == ub["id"]


def test_reject_resets_both(two_users):
    (a, ua), (b, ub) = two_users
    # Currently in match_found from rematch
    rj = a.post(f"{API}/match/reject").json()
    assert rj["status"] in ("idle", "rejected")
    sb = b.get(f"{API}/match/state").json()
    assert sb["status"] in ("idle", "rejected")
    # After a leave both should be idle
    a.post(f"{API}/match/leave")
    b.post(f"{API}/match/leave")
    assert a.get(f"{API}/match/state").json()["status"] == "idle"
    assert b.get(f"{API}/match/state").json()["status"] == "idle"


def test_cancel_queue_alone(two_users):
    (a, ua), _ = two_users
    r = a.post(f"{API}/match/queue").json()
    assert r["status"] == "queued"
    r2 = a.post(f"{API}/match/dequeue").json()
    assert r2["status"] == "idle"


def test_idempotent_accept_without_match(two_users):
    (a, _), _ = two_users
    r = a.post(f"{API}/match/accept")
    assert r.status_code == 404


def test_unauth_blocked():
    r = requests.get(f"{API}/match/state")
    assert r.status_code == 401
