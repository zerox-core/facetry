import uuid

from sqlalchemy import JSON, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .core.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


# ============ 旧系统等价迁移表（JSON blob 语义与旧 node:sqlite 一致） ============


class SessionRow(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    userId: Mapped[str] = mapped_column(String(128), default="")
    name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(255), default="")
    phase: Mapped[str] = mapped_column(String(32), default="prepare")
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class BankQuestionRow(Base):
    __tablename__ = "bank_questions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    part: Mapped[str] = mapped_column(String(16), default="")
    groupId: Mapped[str] = mapped_column(String(128), default="")
    custom: Mapped[int] = mapped_column(Integer, default=0)
    userId: Mapped[str] = mapped_column(String(128), default="")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class BankPartRow(Base):
    __tablename__ = "bank_parts"
    key: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), default="")
    weight: Mapped[int] = mapped_column(Integer, default=0)
    custom: Mapped[int] = mapped_column(Integer, default=0)
    groupId: Mapped[str] = mapped_column(String(128), default="")


class BankMetaRow(Base):
    __tablename__ = "bank_meta"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seededGroups: Mapped[list] = mapped_column(JSON, default=list)


class JdRow(Base):
    __tablename__ = "jds"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    groupId: Mapped[str] = mapped_column(String(128), default="")
    userId: Mapped[str] = mapped_column(String(128), default="")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class UserRow(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    # 业务角色：hr（招聘专员，默认）/ interviewer（面试官）；管理员与超管是独立的权限标记
    role: Mapped[str] = mapped_column(String(20), default="hr")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class AuthRow(Base):
    __tablename__ = "auth"
    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    userId: Mapped[str] = mapped_column(String(128), default="")
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class GrantRow(Base):
    __tablename__ = "grants"
    userId: Mapped[str] = mapped_column(String(128), primary_key=True)
    deptIds: Mapped[list] = mapped_column(JSON, default=list)


class OrgRow(Base):
    __tablename__ = "org"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class MetaRow(Base):
    __tablename__ = "meta"
    k: Mapped[str] = mapped_column(String(64), primary_key=True)
    v: Mapped[str] = mapped_column(Text, default="")


class JobRow(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sessionId: Mapped[str] = mapped_column(String(64), default="")
    state: Mapped[str] = mapped_column(String(16), default="running")
    data: Mapped[dict] = mapped_column(JSON, default=dict)


# ============ 新业务表 ============


class CandidateRow(Base):
    __tablename__ = "candidates"
    __table_args__ = (UniqueConstraint("channel", "sourceId", name="uq_candidate_source"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), default="")
    currentPosition: Mapped[str] = mapped_column(String(255), default="")
    currentCompany: Mapped[str] = mapped_column(String(255), default="")
    expectedCity: Mapped[str] = mapped_column(String(128), default="")
    education: Mapped[str] = mapped_column(String(64), default="")
    major: Mapped[str] = mapped_column(String(128), default="")
    yearsOfExperience: Mapped[int] = mapped_column(Integer, default=-1)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    phone: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    channel: Mapped[str] = mapped_column(String(64), default="")
    channelName: Mapped[str] = mapped_column(String(64), default="")
    sourceId: Mapped[str] = mapped_column(String(128), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    detailUrl: Mapped[str] = mapped_column(String(512), default="")
    stage: Mapped[str] = mapped_column(String(32), default="new")
    ownerId: Mapped[str] = mapped_column(String(128), default="")
    ownerName: Mapped[str] = mapped_column(String(128), default="")
    nextStep: Mapped[str] = mapped_column(String(512), default="")
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    resumeText: Mapped[str] = mapped_column(Text, default="")
    stageHistory: Mapped[list] = mapped_column(JSON, default=list)
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")


class PositionRow(Base):
    __tablename__ = "positions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(128), default="")
    department: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(16), default="open")
    jdContent: Mapped[str] = mapped_column(Text, default="")
    jdRequirements: Mapped[str] = mapped_column(Text, default="")
    jdNote: Mapped[str] = mapped_column(Text, default="")
    jdVersion: Mapped[int] = mapped_column(Integer, default=1)
    jdUpdatedAt: Mapped[str] = mapped_column(String(40), default="")
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")


class PositionVersionRow(Base):
    __tablename__ = "position_versions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    positionId: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")
    updatedBy: Mapped[str] = mapped_column(String(128), default="")


class MatchRow(Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("candidateId", "positionId", name="uq_match_pair"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    candidateId: Mapped[str] = mapped_column(String(64), index=True)
    positionId: Mapped[str] = mapped_column(String(64), index=True)
    verdict: Mapped[str] = mapped_column(String(16), default="")
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(String(255), default="")
    hits: Mapped[list] = mapped_column(JSON, default=list)
    misses: Mapped[list] = mapped_column(JSON, default=list)
    aiSummary: Mapped[str] = mapped_column(Text, default="")
    concerns: Mapped[list] = mapped_column(JSON, default=list)
    jdVersion: Mapped[int] = mapped_column(Integer, default=0)
    jdSnapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    screenedAt: Mapped[str] = mapped_column(String(40), default="")
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")


class FollowUpRow(Base):
    __tablename__ = "followups"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    candidateId: Mapped[str] = mapped_column(String(64), index=True)
    userId: Mapped[str] = mapped_column(String(128), default="")
    userName: Mapped[str] = mapped_column(String(128), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    nextStep: Mapped[str] = mapped_column(String(512), default="")
    createdAt: Mapped[str] = mapped_column(String(40), default="")


class InterviewRow(Base):
    __tablename__ = "interviews"
    __table_args__ = (
        UniqueConstraint("candidateId", "positionId", "round", "startAt", name="uq_interview_natural"),
        UniqueConstraint("idempotencyKey", name="uq_interview_idem"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    candidateId: Mapped[str] = mapped_column(String(64), index=True)
    positionId: Mapped[str] = mapped_column(String(64), default="")
    round: Mapped[str] = mapped_column(String(64), default="")
    mode: Mapped[str] = mapped_column(String(16), default="online")
    startAt: Mapped[str] = mapped_column(String(40), default="")
    endAt: Mapped[str] = mapped_column(String(40), default="")
    location: Mapped[str] = mapped_column(String(512), default="")
    meetingUrl: Mapped[str] = mapped_column(String(1024), default="")
    interviewers: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    notify: Mapped[dict] = mapped_column(JSON, default=dict)
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    history: Mapped[list] = mapped_column(JSON, default=list)
    createdBy: Mapped[str] = mapped_column(String(128), default="")
    idempotencyKey: Mapped[str | None] = mapped_column(String(128), nullable=True)
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")


class OfferRow(Base):
    __tablename__ = "offers"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    candidateId: Mapped[str] = mapped_column(String(64), index=True)
    positionId: Mapped[str] = mapped_column(String(64), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    materials: Mapped[list] = mapped_column(JSON, default=list)
    feishu: Mapped[dict] = mapped_column(JSON, default=dict)
    bpm: Mapped[dict] = mapped_column(JSON, default=dict)
    overall: Mapped[str] = mapped_column(String(16), default="pending")
    history: Mapped[list] = mapped_column(JSON, default=list)
    createdBy: Mapped[str] = mapped_column(String(128), default="")
    createdByName: Mapped[str] = mapped_column(String(128), default="")
    idempotencyKey: Mapped[str | None] = mapped_column(String(128), nullable=True)
    createdAt: Mapped[str] = mapped_column(String(40), default="")
    updatedAt: Mapped[str] = mapped_column(String(40), default="")


class SyncRunRow(Base):
    __tablename__ = "sync_runs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(16), default="running")
    added: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")
    startedAt: Mapped[str] = mapped_column(String(40), default="")
    finishedAt: Mapped[str] = mapped_column(String(40), default="")
