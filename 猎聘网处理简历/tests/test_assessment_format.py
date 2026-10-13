import sys, os
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.jd_loader import load_jds
from app.core.jd_matcher import build_ai_assessment, MatchResult

ROOT = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
jds = load_jds(ROOT / "职位JD汇总.xlsx")
cra_jd = next(j for j in jds if "CRA" in j.name or "临床监查" in j.name)

class Cand:
    def __init__(self, **kw):
        self.name = kw.get("name")
        self.education = kw.get("education", "本科")
        self.major = kw.get("major", "药学")
        self.years_of_experience = kw.get("yoe", 5)
        self.skills = kw.get("skills", [])
        self.current_position = kw.get("current_position", "")
        self.current_company = kw.get("current_company", "")
        self.expected_city = kw.get("expected_city", "全国")
        self.full_text = kw.get("full_text", "")
        self.raw_text = kw.get("full_text", "")

def show(title, cand):
    r = MatchResult(verdict="合适", score=88, reason="test", hits=["CRA"], misses=[])
    a = build_ai_assessment(cand, cra_jd, r)
    assert "highlights" not in a, "highlights 字段未删除!"
    print(f"\n=== {title} ===")
    print("summary:", a["summary"])
    print("concerns:", a["concerns"])

# 1) 普通简历：无特别亮点 -> 不应追加强信号
show("普通CRA（无亮点）", Cand(name="张三", education="本科", major="药学", yoe=5,
    current_company="某小型CRO", current_position="临床监查员",
    full_text="负责II期项目监查，管理3家中心"))

# 2) 知名公司 + 管理 + III期
show("知名药企+管理+III期", Cand(name="李四", education="硕士", major="临床药理", yoe=10,
    current_company="辉瑞", current_position="临床项目经理",
    full_text="曾就职于辉瑞，带领15人团队，主导多个III期临床试验，负责NDA申报"))

# 3) 管理经验但非知名公司
show("管理经验(非知名)", Cand(name="王五", education="本科", major="护理", yoe=8,
    current_company="某生物科技", current_position="CRC主管",
    full_text="负责团队管理，带教5名CRC，负责中心筛选"))

# 4) 专利/SCI亮点
show("专利/论文亮点", Cand(name="赵六", education="博士", major="药学", yoe=6,
    current_company="某药企", current_position="医学经理",
    full_text="发表SCI一作论文3篇，授权发明专利2项"))
print("\nALL OK - highlights 已删除，特别亮点合并进 summary")
