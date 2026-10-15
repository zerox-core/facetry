"""来源库同步：SOURCE_DB_* 配置齐全时只读连接来源库（当前实现 mysql）；
未配置时生成医药行业演示候选人。幂等：(channel, sourceId) 唯一约束。

—— 待采集侧确认事项 ——
来源库表结构与字段映射未最终确认，以下为适配层约定：
表名 SOURCE_TABLE，字段映射见 FIELD_MAP；确认后只需调整这两个常量。
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import CandidateRow, SyncRunRow, iso_now, new_id

logger = logging.getLogger("facetry.source")

# —— 来源库适配层（字段映射待采集侧提供样例后确认）——
SOURCE_TABLE = "candidates"
FIELD_MAP = {
    "source_id": "source_id",
    "name": "name",
    "current_position": "current_position",
    "current_company": "current_company",
    "expected_city": "expected_city",
    "education": "education",
    "major": "major",
    "years": "years_of_experience",
    "skills": "skills",          # 逗号分隔或 JSON 数组
    "phone": "phone",
    "email": "email",
    "channel": "channel",
    "summary": "summary",
    "detail_url": "detail_url",
    "resume_text": "resume_text",
    "updated_at": "updated_at",
}
CHANNEL_NAMES = {"liepin": "猎聘", "51job": "前程无忧", "boss": "BOSS直聘", "demo": "演示数据"}


def _fetch_from_source_db() -> list[dict]:
    """只读来源库拉取候选人；当前仅实现 mysql，其余类型待接入"""
    s = get_settings()
    if s.source_db_type != "mysql":
        raise RuntimeError(f"来源库类型 {s.source_db_type} 暂未实现适配")
    import pymysql
    conn = pymysql.connect(host=s.source_db_host, port=s.source_db_port or 3306,
                           user=s.source_db_user, password=s.source_db_password,
                           database=s.source_db_database, charset="utf8mb4",
                           cursorclass=pymysql.cursors.DictCursor, connect_timeout=15, read_timeout=60)
    try:
        with conn.cursor() as cur:
            cols = ", ".join(f"`{v}` AS `{k}`" for k, v in FIELD_MAP.items())
            cur.execute(f"SELECT {cols} FROM `{SOURCE_TABLE}`")
            return list(cur.fetchall())
    finally:
        conn.close()


def _demo_candidates() -> list[dict]:
    """演示数据生成器：医药行业候选人，字段完整、技能/经历真实感、部分附件缺失"""
    base = [
        {
            "name": "陈思远", "currentPosition": "临床监查员（CRA）", "currentCompany": "泰格医药",
            "expectedCity": "广州", "education": "本科", "major": "药学", "yearsOfExperience": 4,
            "skills": ["GCP", "临床监查", "SDV", "方案偏离管理", "EDC系统"],
            "phone": "13802001234", "email": "chensiyuan@example.com",
            "summary": "4 年肿瘤与心血管领域 II/III 期项目监查经验，独立负责 6 家中心，熟悉 GCP 与 NMPA 核查要点。",
            "resumeText": "陈思远，本科药学专业，4 年 CRA 经验。就职于泰格医药，负责肿瘤 III 期项目华南区 6 家中心的监查工作，"
                          "完成例行访视 120+ 次，SDV 覆盖率 100%，主导 2 次 NMPA 现场核查迎检。熟悉 EDC（Medidata Rave）、CTMS 系统，"
                          "擅长方案偏离管理与中心关系维护。英语 CET-6，可阅读英文方案。期望城市：广州。",
        },
        {
            "name": "林晓雯", "currentPosition": "QA 工程师（质量体系）", "currentCompany": "丽珠集团",
            "expectedCity": "珠海", "education": "硕士", "major": "制药工程", "yearsOfExperience": 6,
            "skills": ["GMP", "质量体系", "偏差管理", "CAPA", "供应商审计", "验证"],
            "phone": "13702565678", "email": "linxw@example.com",
            "summary": "6 年无菌制剂 QA 经验，主导偏差与 CAPA 体系优化，参与 FDA 与欧盟 GMP 审计迎检。",
            "resumeText": "林晓雯，硕士制药工程，6 年 QA 经验。丽珠集团质量体系 QA，负责无菌制剂车间现场 QA 与偏差管理，"
                          "年处理偏差 80+ 起，CAPA 按时关闭率提升至 95%。参与 FDA 现场检查 1 次、欧盟 GMP 审计 2 次，"
                          "主导供应商审计 20+ 家次。熟悉验证生命周期（DQ/IQ/OQ/PQ）。期望城市：珠海。",
        },
        {
            "name": "王振国", "currentPosition": "财务总监", "currentCompany": "某医药流通企业",
            "expectedCity": "深圳", "education": "本科", "major": "会计学", "yearsOfExperience": 15,
            "skills": ["财务分析", "预算管理", "IPO", "税务筹划", "SAP", "内控"],
            "phone": "13907558899", "email": "wangzg@example.com",
            "summary": "15 年财务经验，10 年医药行业，主导过 IPO 申报与两票制合规改造，CPA + 高级会计师。",
            "resumeText": "王振国，本科会计学，CPA、高级会计师。现任医药流通企业财务总监，负责集团 30 亿营收规模的财务管理，"
                          "主导 IPO 上市申报财务模块，完成两票制下税务与资金流合规改造，搭建 SAP FI/CO 与预算管理体系，"
                          "管理团队 25 人。期望城市：深圳。",
        },
        {
            "name": "赵梦琪", "currentPosition": "药物警戒专员（PV）", "currentCompany": "恒瑞医药",
            "expectedCity": "上海", "education": "硕士", "major": "临床药学", "yearsOfExperience": 3,
            "skills": ["药物警戒", "个例报告", "PSUR", "MedDRA", "信号检测", "Argus"],
            "phone": "13601667788", "email": "zhaomq@example.com",
            "summary": "3 年 PV 经验，熟悉个例报告全流程与定期安全性报告撰写，参与药物警戒体系搭建。",
            "resumeText": "赵梦琪，硕士临床药学，3 年药物警戒经验。恒瑞医药 PV 专员，负责个例安全性报告（ICSR）接收、录入、"
                          "医学评价与递交，年处理报告 2000+ 例；参与 PSUR/PBRER 撰写 6 份，使用 Argus 数据库与 MedDRA 编码，"
                          "协助通过 NMPA 药物警戒专项检查。期望城市：上海。",
        },
        {
            "name": "刘一帆", "currentPosition": "注册专员（RA）", "currentCompany": "药明康德",
            "expectedCity": "苏州", "education": "硕士", "major": "药剂学", "yearsOfExperience": 5,
            "skills": ["药品注册", "IND", "NDA", "eCTD", "CDE沟通"],
            "phone": "13505129900", "email": "liuyf@example.com",
            "summary": "5 年化药注册经验，独立完成 2 个 IND 与 1 个 NDA 申报，熟悉 eCTD 格式与 CDE 沟通。",
            "resumeText": "刘一帆，硕士药剂学，5 年药品注册经验。药明康德注册专员，负责化药创新药国内注册，"
                          "独立完成 2 个 IND 申报并获批、1 个 NDA 受理，熟悉 eCTD 申报资料编制与 CDE 沟通交流会议申请，"
                          "跟进药学、临床、非临床各专业资料协调。期望城市：苏州。",
        },
        {
            "name": "孙浩然", "currentPosition": "生产主管", "currentCompany": "白云山制药",
            "expectedCity": "广州", "education": "本科", "major": "生物工程", "yearsOfExperience": 8,
            "skills": ["固体制剂", "生产管理", "GMP", "精益生产", "设备验证"],
            "phone": "13380001122", "email": "sunhr@example.com",
            "summary": "8 年固体制剂生产管理经验，主导多条产线扩产与精益改善，熟悉 GMP 生产现场管理。",
            "resumeText": "孙浩然，本科生物工程，8 年制药生产经验。白云山制药生产主管，管理固体制剂车间 3 条产线 60 人团队，"
                          "主导产能提升项目（OEE 提升 12%），负责设备验证与工艺放大，多次通过 GMP 符合性检查。期望城市：广州。",
        },
        {
            "name": "周雅静", "currentPosition": "医学经理（MA）", "currentCompany": "百济神州",
            "expectedCity": "北京", "education": "博士", "major": "肿瘤学", "yearsOfExperience": 7,
            "skills": ["医学事务", "KOL管理", "循证医学", "学术推广", "IIT"],
            "phone": "13401103344", "email": "zhouyj@example.com",
            "summary": "肿瘤学博士，7 年医学事务经验，负责实体瘤产品线医学策略，KOL 网络覆盖华北区 TOP50。",
            "resumeText": "周雅静，肿瘤学博士（临床医学背景），7 年医学事务经验。百济神州医学经理，负责实体瘤产品线医学策略制定，"
                          "管理华北区 KOL 网络，主导 4 项 IIT 研究的医学支持，组织学术会议 30+ 场。期望城市：北京。",
        },
        {
            "name": "郑凯文", "currentPosition": "CRC 主管", "currentCompany": "普蕊斯",
            "expectedCity": "杭州", "education": "本科", "major": "护理学", "yearsOfExperience": 6,
            "skills": ["CRC", "临床试验协调", "受试者管理", "GCP"],
            "phone": "13705716655", "email": "zhengkw@example.com",
            "summary": "6 年临床试验协调经验，管理 15 人 CRC 团队，覆盖肿瘤与代谢领域项目。",
            "resumeText": "郑凯文，本科护理学，6 年 CRC 经验。普蕊斯 CRC 主管，管理杭州区域 15 人团队，服务肿瘤、代谢领域 "
                          "III 期项目 8 个，擅长受试者招募与依从性管理，团队项目入组达标率 110%。期望城市：杭州。",
        },
        {
            "name": "黄启铭", "currentPosition": "商务拓展经理（BD）", "currentCompany": "某 Biotech",
            "expectedCity": "上海", "education": "硕士", "major": "药物化学", "yearsOfExperience": 9,
            "skills": ["License-in", "License-out", "商务谈判", "尽调", "估值建模"],
            "phone": "13917722233", "email": "huangqm@example.com",
            "summary": "9 年医药 BD 经验，完成 3 个 license-in 交易（总额超 2 亿美元），药学背景 + MBA。",
            "resumeText": "黄启铭，硕士药物化学，MBA。现任 Biotech BD 经理，主导 3 个 license-in 项目从寻源、尽调到签约"
                          "（累计交易总额超 2 亿美元），参与 1 个 license-out 谈判，具备财务建模与估值能力。期望城市：上海。",
        },
        {
            "name": "吴佩珊", "currentPosition": "质量研究员（QC）", "currentCompany": "联邦制药",
            "expectedCity": "中山", "education": "本科", "major": "药物分析", "yearsOfExperience": 2,
            "skills": ["HPLC", "GC", "方法学验证", "理化检验"],
            "phone": "13560447766", "email": "wups@example.com",
            "summary": "2 年 QC 理化检验经验，熟练 HPLC/GC 操作与方法学验证。",
            "resumeText": "吴佩珊，本科药物分析，2 年 QC 经验。联邦制药质量研究员，负责原料药与制剂理化检验，"
                          "熟练 HPLC、GC、溶出仪操作，参与 3 个分析方法学验证与转移。期望城市：中山。",
        },
    ]
    now = iso_now()
    out = []
    for i, c in enumerate(base):
        # 部分候选人附件缺失，贴合真实采集场景
        attachments = [{"id": new_id(), "name": f"{c['name']}-简历.pdf", "kind": "original", "url": ""}] \
            if i % 3 == 2 else [{"id": new_id(), "name": f"{c['name']}-简历.pdf", "kind": "platform", "url": ""}]
        # 输出键与 FIELD_MAP（来源库适配层）保持一致
        out.append({
            "source_id": f"demo-{i + 1:03d}",
            "channel": "demo",
            "attachments": attachments,
            "detail_url": "",
            "updated_at": now,
            "name": c["name"], "current_position": c["currentPosition"],
            "current_company": c["currentCompany"], "expected_city": c["expectedCity"],
            "education": c["education"], "major": c["major"], "years": c["yearsOfExperience"],
            "skills": c["skills"], "phone": c["phone"], "email": c["email"],
            "summary": c["summary"], "resume_text": c["resumeText"],
        })
    return out


def run_sync(db: Session) -> dict:
    """执行一次同步；返回 {added, error}。幂等：(channel, sourceId) 已有记录跳过建档"""
    s = get_settings()
    run = SyncRunRow(id=new_id(), source=s.source_db_type or "demo", status="running", startedAt=iso_now())
    db.add(run)
    db.commit()
    added = 0
    error = ""
    try:
        raw = _fetch_from_source_db() if s.source_db_configured else _demo_candidates()
        for item in raw:
            channel = str(item.get("channel") or "demo")
            source_id = str(item.get("source_id") or "")
            if not source_id:
                continue
            exists = db.scalars(select(CandidateRow).where(CandidateRow.channel == channel,
                                                           CandidateRow.sourceId == source_id)).first()
            if exists:
                continue  # 重复同步不重复建档；来源更新不覆盖工作台已确认业务数据
            skills = item.get("skills")
            if isinstance(skills, str):
                skills = [x.strip() for x in skills.split(",") if x.strip()]
            years = item.get("years")
            try:
                years = int(years)
            except (TypeError, ValueError):
                years = -1
            now = iso_now()
            db.add(CandidateRow(
                id=new_id(), name=str(item.get("name") or "未命名"), currentPosition=str(item.get("current_position") or ""),
                currentCompany=str(item.get("current_company") or ""), expectedCity=str(item.get("expected_city") or ""),
                education=str(item.get("education") or ""), major=str(item.get("major") or ""), yearsOfExperience=years,
                skills=skills or [], phone=str(item.get("phone") or ""), email=str(item.get("email") or ""),
                channel=channel, channelName=CHANNEL_NAMES.get(channel, channel), sourceId=source_id,
                summary=str(item.get("summary") or ""), detailUrl=str(item.get("detail_url") or ""),
                stage="new", ownerId="", ownerName="", nextStep="",
                attachments=item.get("attachments") or [], resumeText=str(item.get("resume_text") or ""),
                stageHistory=[], createdAt=now, updatedAt=now,
            ))
            added += 1
        run.status = "done"
        run.added = added
    except Exception as e:
        logger.error("来源库同步失败: %s", e)
        run.status = "error"
        error = str(e)
        run.error = error
    run.finishedAt = iso_now()
    db.commit()
    if run.status == "error":
        raise RuntimeError(error)
    return {"added": added, "error": ""}


async def execute_source_sync(job: dict) -> None:
    from ..core.database import SessionLocal
    with SessionLocal() as db:
        run_sync(db)
