"""Run: python frontend-v2/tests/backend_integration.py (isolated temporary DB)."""
import unittest
from fastapi.testclient import TestClient
from serve_backend import app, SessionLocal
from app.models import CandidateRow, MatchRow, PositionRow, iso_now


class RecruitmentFlow(unittest.TestCase):
    def test_persistent_recruitment_flow(self):
        with TestClient(app) as client:
            def call(method, path, body=None, status=200):
                response = client.request(method, "/api" + path, json=body) if body is not None else client.request(method, "/api" + path)
                self.assertEqual(response.status_code, status, response.text)
                return response.json() if response.content else None

            call("GET", "/auth/me", status=401)
            call("POST", "/auth/demo", {"name": "演示用户"})
            self.assertTrue(call("GET", "/auth/me")["user"]["isAdmin"])
            candidate = "preview-linked"
            jd = call("POST", "/jds", {"title":"集成测试 JD", "content":"React 开发", "requirements":"TypeScript"}, 201)
            position = call("POST", "/positions", {"title":"集成测试岗位", "jd":{"content":jd["content"],"requirements":jd["requirements"]}}, 201)
            updated = call("PATCH", "/positions/" + position["id"], {"jd":{"content":"React 开发和接口测试", "requirements":"TypeScript"}})
            self.assertEqual(updated["jd"]["version"], 2)
            call("POST", f"/candidates/{candidate}/followups", {"content":"接口联调跟进", "nextStep":"安排面试"}, 201)
            call("PATCH", f"/candidates/{candidate}", {"stage":"contact"})
            self.assertEqual(call("GET", f"/candidates/{candidate}")["followups"][0]["content"], "接口联调跟进")

            # More than two associations must survive the list response.
            with SessionLocal() as db:
                now = iso_now()
                for n in range(3):
                    pid = f"test-multi-{n}"
                    db.add(PositionRow(id=pid,title=pid,createdAt=now,updatedAt=now))
                    db.add(MatchRow(id=pid,candidateId=candidate,positionId=pid,jdVersion=1,createdAt=now,updatedAt=now))
                db.commit()
            row = next(c for c in call("GET", "/candidates?size=100")["candidates"] if c["id"] == candidate)
            self.assertEqual(len(row["matches"]), 4)

            def schedule(round_):
                return call("POST", "/interviews", {"candidateId":candidate,"positionId":"preview-position","round":round_,"mode":"online",
                    "startAt":"2026-10-20T06:00:00.000Z","endAt":"2026-10-20T06:45:00.000Z","interviewerIds":["demo:演示用户"],"idempotencyKey":f"test-{round_}"}, 201)
            first, second = schedule("一面"), schedule("二面")
            self.assertEqual(schedule("一面")["id"], first["id"])
            call("PATCH", f"/interviews/{second['id']}", {"action":"reschedule","startAt":"2026-10-21T06:00:00.000Z","endAt":"2026-10-21T06:45:00.000Z","reason":"测试改期"})
            call("POST", f"/interviews/{first['id']}/feedback", {"scores":[{"dimension":"综合评价","score":4}],"note":"一面草稿","conclusion":"通过"})
            call("POST", f"/interviews/{second['id']}/feedback", {"scores":[{"dimension":"综合评价","score":3}],"note":"二面独立草稿","conclusion":"待定"})
            call("POST", f"/interviews/{first['id']}/feedback/confirm", {"scores":[{"dimension":"综合评价","score":4}],"note":"一面已确认","conclusion":"通过"})
            records = call("GET", "/interviews")["interviews"]
            self.assertEqual(next(i for i in records if i["id"] == second["id"])["feedback"]["note"], "二面独立草稿")
            call("PATCH", f"/interviews/{second['id']}", {"action":"cancel","reason":"测试取消"})

            offer = call("POST", "/offers", {"candidateId":candidate,"positionId":"preview-position","note":"隔离测试申请"}, 201)
            self.assertTrue(offer["feishu"]["instanceId"].startswith("MOCK-"))
            self.assertTrue(offer["bpm"]["processId"].startswith("MOCK-"))
            call("POST", f"/offers/{offer['id']}/refresh")
            canceled = call("POST", f"/offers/{offer['id']}/cancel")
            self.assertEqual(canceled["overall"], "canceled")
            self.assertEqual(call("GET", f"/offers/{offer['id']}")["note"], "隔离测试申请")
            call("POST", "/auth/logout", status=204)
            call("GET", "/auth/me", status=401)


if __name__ == "__main__":
    unittest.main()
