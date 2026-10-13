"""验证两处修复：应聘岗位匹配 + 期望城市提取（Python 侧）"""
import sys
sys.path.insert(0, '.')

from app.core.scanner import Scanner

# 轻量实例化（会加载配置/DB/JD，本机已就绪）
sc = Scanner.__new__(Scanner)
sc.cfg = {}
from app.core.jd_loader import load_jds
from app.core.config import get_jd_path
sc.jds = load_jds(get_jd_path())

# 找到 PM 与生产副总 JD 用于断言
jd_pm = next(j for j in sc.jds if '临床项目经理' in j.name)
jd_prod = next(j for j in sc.jds if '生产副总经理' in j.name)

cases = [
    # 1) 程女士式：卡片顶部"应聘职位：临床项目经理"，后文出现"生产副总经理"（既往经历）
    ("应聘职位：临床项目经理 程女士 女 40岁 ... 工作经历：生产副总经理 @某药厂 ...", jd_pm),
    # 2) 没有标记，但"临床项目经理"在"生产副总经理"之前出现
    ("程女士 临床项目经理 比逊医疗 ... 既往 生产副总经理 ...", jd_pm),
    # 3) 只有生产副总经理（应退化匹配到生产副总）
    ("张先生 生产副总经理 宁夏丽珠 ...", jd_prod),
    # 4) 带城市/编号噪声的应聘名
    ("应聘职位：临床项目经理PM/高级临床项目经理SPM #7845 李女士 ...", jd_pm),
]

print("=== 应聘岗位匹配 ===")
ok = True
for text, expect in cases:
    got = sc._match_applied_jd(text)
    status = "OK " if got and got.name == expect.name else "FAIL"
    if status == "FAIL":
        ok = False
    print(f"  [{status}] -> {got.name if got else None}  (期望 {expect.name})")
print("RESULT:", "全部通过" if ok else "存在失败")

# 期望城市提取用 Node 单独测（见 test_city_parse.js）
