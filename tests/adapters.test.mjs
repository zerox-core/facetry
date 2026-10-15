import test from "node:test";
import assert from "node:assert/strict";
import {
  allCandidates,
  candidateModel,
  positionJd,
  libraryJd,
  interviewTimes,
  safeAttachmentUrl,
} from "../src/adapters.mjs";

test("loads all candidate pages instead of silently truncating at 20 or 100", async () => {
  const calls = [];
  const result = await allCandidates({
    listCandidates: async ({ page, size }) => {
      calls.push({ page, size });
      return {
        total: 205,
        candidates: Array.from({ length: page === 3 ? 5 : 100 }, (_, i) => ({
          id: (page - 1) * 100 + i,
        })),
      };
    },
  });
  assert.equal(result.length, 205);
  assert.equal(result.at(-1).id, 204);
  assert.deepEqual(
    calls.map((c) => c.page),
    [1, 2, 3],
  );
});

test("unassigned candidates and missing resume fields do not create fictitious data", () => {
  const p = candidateModel({
    id: "c",
    name: "测试",
    stage: "new",
    yearsOfExperience: -1,
  });
  assert.deepEqual(p.apps, []);
  assert.equal(p.years, "年限未填写");
  assert.equal(p.file, false);
  assert.equal(p.phone, undefined);
});

test("detail matches and every followup replace skinny list summaries", () => {
  const row = {
    id: "c",
    name: "测试",
    stage: "new",
    matches: [{ id: "m1", positionId: "p1" }],
  };
  const detail = {
    candidate: row,
    matches: [
      { id: "m1", positionId: "p1", jdVersion: 2 },
      { id: "m2", positionId: "p2", score: 0 },
    ],
    followups: [{ id: "f1" }, { id: "f2" }],
  };
  const p = candidateModel(row, detail);
  assert.equal(p.apps.length, 2);
  assert.equal(p.apps[0].jdVersion, 2);
  assert.equal(p.apps[1].score, 0);
  assert.equal(p.followups.length, 2);
});

test("position JD and template IDs cannot collide", () => {
  const p = positionJd({
    id: "same",
    title: "岗位",
    jd: { version: 3, content: "正文", requirements: "要求", note: "备注" },
  });
  const j = libraryJd({
    id: "same",
    title: "模板",
    content: "正文",
    requirements: "",
  });
  assert.notEqual(p.id, j.id);
  assert.equal(p.positionId, "same");
  assert.equal(j.libraryId, "same");
  assert.equal(p.version, 3);
});

test("scheduling preserves local date/time and duration using UTC payloads", () => {
  const times = interviewTimes("2026-10-20", "14:30", "45");
  const date = new Date(times.startAt);
  assert.equal(date.getHours(), 14);
  assert.equal(date.getMinutes(), 30);
  assert.equal((new Date(times.endAt) - date) / 60000, 45);
  assert.throws(() => interviewTimes("invalid", "14:30", "45"));
});

test("attachment URLs reject executable protocols", () => {
  assert.equal(safeAttachmentUrl("javascript:alert(1)"), "");
  assert.equal(safeAttachmentUrl("data:text/html,test"), "");
  assert.equal(
    safeAttachmentUrl("https://example.com/resume.pdf"),
    "https://example.com/resume.pdf",
  );
  assert.ok(
    safeAttachmentUrl("/files/resume.pdf").endsWith("/files/resume.pdf"),
  );
});
