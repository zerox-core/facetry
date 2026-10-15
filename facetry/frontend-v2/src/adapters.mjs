export const STAGES = {
  new: "新入库",
  screening: "筛选中",
  contact: "待联系",
  interviewing: "已约面",
  evaluating: "面评中",
  offer: "待录取",
  done: "已完成",
  parked: "搁置",
};
export const SIDE_STATES = {
  pending: "未发起",
  submitted: "已发起",
  processing: "处理中",
  approved: "通过",
  returned: "退回",
  rejected: "拒绝",
  canceled: "撤销",
  error: "异常",
};
export const NOTIFY_STATES = {
  pending: "等待处理",
  sent: "已发送",
  failed: "发送失败",
  skipped: "未配置或无联系方式",
};
export const dateText = (value) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
export const dateInput = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function candidateModel(row, detail) {
  const raw = detail?.candidate || row;
  return {
    ...raw,
    initial: raw.name?.slice(0, 1) || "?",
    role: raw.currentPosition || "岗位未填写",
    company: raw.currentCompany || "公司未填写",
    city: raw.expectedCity || "城市未填写",
    degree: raw.education || "学历未填写",
    years:
      raw.yearsOfExperience >= 0
        ? `${raw.yearsOfExperience} 年经验`
        : "年限未填写",
    tags: raw.skills || [],
    source: raw.channelName || raw.channel || "未标注来源",
    updated: dateText(raw.updatedAt),
    status: STAGES[raw.stage] || raw.stage,
    apps: (detail?.matches || row.matches || []).map((m) => ({
      ...m,
      job: m.positionId,
      jdVersion: m.jdVersion,
    })),
    file: (raw.attachments || []).some((a) => a.url),
    followups: detail?.followups || [],
  };
}

export function positionModel(p) {
  return {
    ...p,
    name: p.title,
    dept: p.department || "团队未填写",
    location: p.city || "地点未填写",
    jd: `position:${p.id}`,
  };
}

export function positionJd(p) {
  return {
    id: `position:${p.id}`,
    positionId: p.id,
    title: p.title,
    version: p.jd.version,
    updated: dateText(p.jd.updatedAt),
    intro: p.jd.content.split("\n")[0],
    duties: p.jd.content,
    must: p.jd.requirements || "",
    bonus: p.jd.note || "",
    kind: "position",
  };
}

export function libraryJd(j) {
  return {
    id: `library:${j.id}`,
    libraryId: j.id,
    title: j.title,
    version: null,
    updated: dateText(j.updatedAt),
    intro: j.company || "",
    duties: j.content,
    must: j.requirements || "",
    bonus: "",
    readonly: j.readonly,
    kind: "library",
  };
}

export async function allCandidates(api) {
  const candidates = [];
  let total = Infinity;
  for (let page = 1; candidates.length < total; page++) {
    const result = await api.listCandidates({ page, size: 100 });
    total = result.total;
    candidates.push(...result.candidates);
    if (!result.candidates.length) break;
  }
  return candidates;
}

export function interviewTimes(date, time, duration) {
  const start = new Date(`${date}T${time}`);
  if (!Number.isFinite(start.getTime()) || Number(duration) <= 0)
    throw new Error("请填写有效的面试日期和时长");
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + Number(duration) * 60000).toISOString(),
  };
}

export function safeAttachmentUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(
      url,
      globalThis.location?.href || "http://localhost/",
    );
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}
