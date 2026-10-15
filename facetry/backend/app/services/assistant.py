"""面试助手 analyze / evaluate 两阶段任务执行器：逻辑等价迁移自旧 server/server.js"""
import json
import re

from ..core.database import SessionLocal
from ..core.errors import fail
from ..core.prompts import EVALUATE, GENERATE, OUTLINE
from ..models import new_id
from . import jobs, llm, perm
from .sessions import get_session, save_session
from .util import clip, norm_text
from .jds_store import load_jds
from .bank_store import load_bank


def resolve_anchor(a: dict, lines: list, pages: int) -> dict:
    quote = norm_text(a.get("quote"))
    line = next((l for l in lines if l.get("id") == a.get("lineId")), None)
    if line is None and len(quote) > 2:
        line = next(
            (l for l in lines
             if quote in norm_text(l.get("text")) or (len(norm_text(l.get("text"))) > 3 and norm_text(l.get("text")) in quote)),
            None,
        )
    page = max(1, min(pages, int(a.get("page") or 1) if str(a.get("page") or "").lstrip("-").isdigit() or isinstance(a.get("page"), (int, float)) else 1))
    if line:
        return {"lineId": line["id"], "page": line["page"], "y": line["y"], "x": line.get("x", 0.1), "quote": line["text"], "matched": True}
    try:
        y = float(a.get("y") or 0.2)
    except (TypeError, ValueError):
        y = 0.2
    return {"page": page, "y": max(0.03, min(0.94, y)), "x": 0.1, "quote": clip(a.get("quote")), "matched": False}


def sort_by_position(sections: list) -> list:
    return sorted(sections, key=lambda s: ((s.get("anchor") or {}).get("page", 1), (s.get("anchor") or {}).get("y", 0)))


def normalize_question(q: dict) -> dict:
    expected = q.get("expected")
    if not isinstance(expected, list):
        expected = [expected]
    return {
        "id": new_id(),
        "type": clip(q.get("type"), 30) or "经历深挖",
        "q": clip(q.get("q")),
        "point": clip(q.get("point")),
        "followUp": clip(q.get("followUp")),
        "expected": [clip(x) for x in expected if isinstance(x, str)],
        "excluded": False,
        "score": None,
        "note": "",
    }


def normalize_outline(result: dict, lines: list, pages: int) -> dict:
    sections = result.get("sections")
    if not isinstance(sections, list) or not sections:
        raise fail("没有识别到简历内容，请换用清晰的 PDF 或 Word 文件", 422)
    out = []
    for s in sections[:20]:
        out.append({
            "id": new_id(),
            "title": clip(s.get("title"), 100) or "简历经历",
            "kind": s.get("kind") if s.get("kind") in ("project", "experience", "skills", "education") else "experience",
            "anchor": resolve_anchor(s.get("anchor") or {}, lines, pages),
        })
    return {"name": clip(result.get("name"), 80), "role": clip(result.get("role"), 100), "summary": clip(result.get("summary")), "sections": sort_by_position(out)}


def normalize_questions(result: dict, outline: list) -> list:
    norm = lambda t: re.sub(r"\s+", "", str(t or ""))
    by_title = {norm(s["title"]): s for s in outline}
    remaining = {s["id"] for s in outline}
    out = []
    sections = result.get("sections")
    for sec in (sections if isinstance(sections, list) else [])[:20]:
        qs = [normalize_question(q) for q in (sec.get("questions") if isinstance(sec.get("questions"), list) else []) if isinstance(q.get("q"), str) and q["q"].strip()][:4]
        if not qs:
            continue
        target = by_title.get(norm(sec.get("title")))
        if target is None:
            b = norm(sec.get("title"))
            target = next((s for s in outline if norm(s["title"]) and b and (norm(s["title"]) in b or b in norm(s["title"]))), None)
        if target and target["id"] in remaining:
            out.append({**target, "questions": qs})
            remaining.discard(target["id"])
        elif target:
            next(o for o in out if o["id"] == target["id"])["questions"].extend(qs)
        else:
            out.append({"id": new_id(), "title": clip(sec.get("title"), 100) or "补充问题", "kind": "custom", "anchor": None, "questions": qs})
    if not out:
        raise fail("模型未生成有效题目，请重试", 422)
    order = {s["id"]: i for i, s in enumerate(outline)}
    out.sort(key=lambda s: order.get(s["id"], 999))
    return out


def match_jd(role: str, jds: list) -> dict | None:
    """识别出的岗位方向与现有 JD 互相包含即视为同一岗位，自动关联"""
    norm = lambda s: re.sub(r"[\s（）()，,、·\-—_【】\[\]：:]", "", str(s or "").lower())
    r = norm(role)
    if not r:
        return None
    for j in jds:
        t = norm(j.get("title"))
        if t and (t in r or r in t):
            return j
    return None


async def execute_analyze(job: dict) -> None:
    b = job.get("payload") or {}
    with SessionLocal() as db:
        s0 = get_session(db, job["sessionId"])
        lines = b.get("lines") or s0.get("lines") or []
        pages = b.get("pageCount") or s0.get("pageCount") or 1
        images = b.get("images") or []
        owner = {"id": s0.get("userId", "")}
        bank_qs = [q for q in load_bank(db)["questions"] if perm.can_view_scoped(db, owner, q)]
        ref_qs = ([q for q in bank_qs if q.get("jdId") == s0.get("jdId")] if s0.get("jdId") else []) + [q for q in bank_qs if not q.get("jdId")]
        ref_qs = ref_qs[:40]
        bank_ref = ""
        if ref_qs:
            bank_ref = "\n\n题库参考（约六成题目从中选取高相关度的并结合简历改写，保持考察方向，不要照抄）：\n" + "\n".join(
                f"[{q.get('partName')}] {q.get('title') + '：' if q.get('title') else ''}{clip(q.get('q'), 200)}" for q in ref_qs)
        lines_text = "\n".join(f"[{l['id']} 页{l['page']} y={float(l['y']):.3f}] {l['text']}" for l in lines)
        reuse_outline = b.get("force") is True and isinstance(s0.get("outline"), list) and s0["outline"]
        if reuse_outline:
            outline = s0["outline"]
            meta = None
        else:
            job["stage"] = "outline"
            jobs.persist_jobs()
            content = [{"type": "text", "text": f"目标岗位：{clip(b.get('role'), 100) or '按简历求职方向'}\n页数：{pages}\n以下为带定位的原文行：\n{lines_text}"}]
            content += [{"type": "image_url", "image_url": {"url": img}} for img in images]
            meta = normalize_outline(await llm.llm_chat([{"role": "system", "content": OUTLINE}, {"role": "user", "content": content}]), lines, pages)
            outline = meta["sections"]
        job["stage"] = "questions"
        jobs.persist_jobs()
        gen_content = [{"type": "text", "text": f"目标岗位：{clip(b.get('role'), 100) or s0.get('role') or '按简历求职方向'}\n板块提纲（返回的 section title 必须与下列标题逐字一致）：\n" + "\n".join(f"- {o['title']}" for o in outline) + f"\n以下为带定位的原文行：\n{lines_text}{bank_ref}"}]
        gen_content += [{"type": "image_url", "image_url": {"url": img}} for img in images]
        gen_result = await llm.llm_chat([{"role": "system", "content": GENERATE}, {"role": "user", "content": gen_content}])
        sections = normalize_questions(gen_result, outline)
        s = get_session(db, job["sessionId"])
        if meta:
            visible = [j for j in load_jds(db)["jds"] if perm.can_view_scoped(db, {"id": s.get("userId", "")}, j)]
            jd = next((j for j in visible if j["id"] == s.get("jdId")), None) if s.get("jdId") else None
            if not jd:
                jd = match_jd(clip(b.get("role"), 100) or meta["role"], visible)
            s["role"] = jd["title"] if jd else clip(b.get("role"), 100)
            s.update({"name": meta["name"] or s.get("name", ""), "summary": meta["summary"], "outline": outline, "lines": lines, "pageCount": pages})
            if jd:
                s["jdId"] = jd["id"]
        s["sections"] = sections
        s["evaluation"] = None
        save_session(db, s)


async def execute_evaluate(job: dict) -> None:
    with SessionLocal() as db:
        s = get_session(db, job["sessionId"])
        records = [{**q, "section": sec["title"]} for sec in s["sections"] for q in sec["questions"] if not q.get("excluded")]
        snapshot = json.dumps({"records": records, "note": s.get("note", "")}, ensure_ascii=False, sort_keys=True)
        question_labels = {}
        i = 0
        for sec in s["sections"]:
            for q in sec["questions"]:
                i += 1
                question_labels[q["id"]] = "Q" + str(i).zfill(2)
        payload = {
            "name": s.get("name", ""), "role": s.get("role", ""),
            "totalQuestions": len(records),
            "scoredCount": len([q for q in records if q.get("score") is not None]),
            "records": [{**q, "id": question_labels.get(q["id"])} for q in records if q.get("score") is not None or (q.get("note") or "").strip()],
            "note": s.get("note", ""),
        }
        evaluation = await llm.llm_chat([{"role": "system", "content": EVALUATE}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}])
        if not evaluation or not isinstance(evaluation.get("overall"), str) or not evaluation["overall"].strip() \
                or not isinstance(evaluation.get("suggestion"), str) or not isinstance(evaluation.get("strengths"), list) \
                or not isinstance(evaluation.get("weaknesses"), list):
            raise fail("评价内容不完整，请重试", 502)
        s = get_session(db, s["id"])
        current = [{**q, "section": sec["title"]} for sec in s["sections"] for q in sec["questions"] if not q.get("excluded")]
        if json.dumps({"records": current, "note": s.get("note", "")}, ensure_ascii=False, sort_keys=True) != snapshot:
            raise fail("生成期间记录有更新，请根据最新记录重新生成", 409)
        from ..models import iso_now
        evidence = []
        for x in (evaluation.get("evidence") if isinstance(evaluation.get("evidence"), list) else []):
            found = next((q["id"] for q in records if q["id"] == x or question_labels.get(q["id"]) == x), None)
            if found and found not in evidence:
                evidence.append(found)
        s["evaluation"] = {
            "overall": clip(evaluation.get("overall"), 6000),
            "suggestion": clip(evaluation.get("suggestion"), 6000),
            "strengths": [x for x in (clip(v) for v in evaluation["strengths"]) if x],
            "weaknesses": [x for x in (clip(v) for v in evaluation["weaknesses"]) if x],
            "nextSteps": [x for x in (clip(v) for v in (evaluation.get("nextSteps") if isinstance(evaluation.get("nextSteps"), list) else [])) if x],
            "evidence": evidence,
            "generatedAt": iso_now(),
        }
        save_session(db, s)
