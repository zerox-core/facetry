import React from "react";
import { Button, Badge, Empty, Resume, I } from "./UI";
import {
  STAGES,
  SIDE_STATES,
  NOTIFY_STATES,
  dateText,
  safeAttachmentUrl,
} from "./adapters.mjs";
const {
  MagnifyingGlass,
  X,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Paperclip,
  NotePencil,
  CalendarBlank,
  LinkSimple,
  Sparkle,
  MapPin,
  FileText,
  Clock,
  Users,
  VideoCamera,
  CheckCircle,
  WarningCircle,
  ArrowClockwise,
} = I;

export function TalentView({ c }) {
  const {
    people,
    jobs,
    person,
    job,
    jd,
    app,
    query,
    setQuery,
    jobFilter,
    setJobFilter,
    source,
    setSource,
    stage,
    setStage,
    filtered,
    selected,
    setSelected,
    detailTab,
    setDetailTab,
    setModal,
    run,
    busy,
    schedule,
    offer,
    interviews,
    screenMatch,
    api,
    detailLoading,
    detailError,
    resumeText,
  } = c;
  const sources = [...new Set(people.map((p) => p.source))];
  const reset = () => {
    setQuery("");
    setStage("全部人才");
    setJobFilter("all");
    setSource("全部来源");
  };
  return (
    <>
      <div className="filter-bar">
        <div className="search-field">
          <MagnifyingGlass size={19} />
          <input
            aria-label="搜索人才"
            placeholder="搜索姓名、经历或技能"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="清空搜索" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </div>
        <select
          aria-label="按岗位筛选"
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
        >
          <option value="all">全部岗位</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <select
          aria-label="按来源筛选"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option>全部来源</option>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="按阶段筛选"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option>全部人才</option>
          {Object.values(STAGES).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="filter-hint">共 {filtered.length} 位人才</span>
      </div>
      <div className="talent-workspace">
        <aside className="candidate-pane">
          <div className="stage-tabs" aria-label="人才阶段">
            {["全部人才", "新入库", "待联系", "已约面"].map((s) => (
              <button
                key={s}
                className={stage === s ? "active" : ""}
                onClick={() => setStage(s)}
              >
                {s === "全部人才" ? "全部" : s}
                <span>
                  {
                    people.filter((p) => s === "全部人才" || p.status === s)
                      .length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="candidate-list">
            {!filtered.length ? (
              <Empty
                title="没有找到匹配的人才"
                body={
                  people.length
                    ? "试试其他姓名、技能或筛选条件。"
                    : "来源数据库同步后，候选人会出现在这里。"
                }
                action={<Button onClick={reset}>清除筛选</Button>}
              />
            ) : (
              filtered.map((p) => {
                const a = p.apps.find((a) => a.job === jobFilter) || p.apps[0];
                return (
                  <button
                    className={
                      "candidate-row " + (selected === p.id ? "selected" : "")
                    }
                    key={p.id}
                    onClick={() => {
                      setSelected(p.id);
                      setDetailTab("resume");
                    }}
                  >
                    <div className="row-title">
                      <span className="avatar">{p.initial}</span>
                      <div>
                        <h3>{p.name}</h3>
                        <span>
                          {p.years} · {p.degree} · {p.city}
                        </span>
                      </div>
                      <span
                        className={
                          "match-number " + (a?.score >= 88 ? "high" : "")
                        }
                      >
                        {a?.score ?? "—"}
                        <small>匹配参考</small>
                      </span>
                    </div>
                    <div className="candidate-role">
                      {jobs.find((j) => j.id === a?.job)?.name ||
                        "尚未关联岗位"}
                      <span> · {p.company}</span>
                    </div>
                    <div className="row-footer">
                      <span
                        className={
                          "stage-label " + (p.stage === "new" ? "new" : "")
                        }
                      >
                        {p.status}
                      </span>
                      <span>
                        {p.source}
                        <span className="small-divider" />
                        {p.updated.split(" ")[0]}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="pane-foot">
            <LinkSimple size={14} />
            数据来自已接入的来源数据库
          </div>
        </aside>
        {!filtered.length || !person ? (
          <section className="detail-pane">
            <Empty
              title="选择一位候选人，开始了解"
              body="同步人才或调整筛选条件后，可查看简历与岗位匹配。"
            />
          </section>
        ) : (
          <section className="detail-pane" aria-label="候选人详情">
            <div className="detail-top">
              <div className="detail-title">
                <span className="detail-person-name">{person.name}</span>
                <select
                  aria-label="更新候选人阶段"
                  value={person.stage}
                  disabled={busy || detailLoading || c.interviewer}
                  onChange={(e) =>
                    run(
                      () =>
                        api.patchCandidate(person.id, {
                          stage: e.target.value,
                        }),
                      "候选人阶段已更新",
                      false,
                    )
                  }
                >
                  {Object.entries(STAGES).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="detail-actions">
                <Button
                  disabled={busy || detailLoading || c.interviewer}
                  icon={NotePencil}
                  kind="quiet"
                  onClick={() => setModal({ type: "note" })}
                >
                  记跟进
                </Button>
                <Button
                  disabled={busy || detailLoading || c.interviewer}
                  icon={CalendarBlank}
                  kind="primary"
                  onClick={() => schedule()}
                >
                  {person.stage === "interviewing" ? "再约一轮" : "安排面试"}
                </Button>
              </div>
            </div>
            <div className="job-linkline">
              <Briefcase size={15} />
              {job ? (
                <>
                  <select
                    aria-label="候选人关联岗位"
                    value={job.id}
                    onChange={(e) => setJobFilter(e.target.value)}
                  >
                    {person.apps.map((a) => (
                      <option key={a.job} value={a.job}>
                        {jobs.find((j) => j.id === a.job)?.name ||
                          a.positionTitle ||
                          "历史岗位"}
                      </option>
                    ))}
                  </select>
                  {jd && (
                    <button
                      className="jd-inline"
                      onClick={() => setModal({ type: "jd-view", jd })}
                    >
                      JD v{jd.version}
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </>
              ) : (
                <span>尚未关联在招岗位</span>
              )}
              <button
                disabled={busy || detailLoading || c.interviewer}
                className="add-link"
                onClick={() => setModal({ type: "attach" })}
              >
                <Plus size={14} />
                关联岗位
              </button>
              {app && jd && (
                <span className="association-note">
                  {app.jdVersion !== jd.version
                    ? "JD 已更新，原评估 v" + app.jdVersion
                    : "以岗位 JD 为匹配依据"}
                </span>
              )}
            </div>
            <div className="detail-tabs">
              <div>
                {[
                  { id: "resume", label: "简历与匹配" },
                  {
                    id: "activity",
                    label: "跟进记录",
                    count: person.followups.length,
                  },
                  {
                    id: "feedback",
                    label: "面试评价",
                    count: interviews.filter(
                      (i) => i.candidateId === person.id && i.feedback,
                    ).length,
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={detailTab === t.id ? "active" : ""}
                    onClick={() => setDetailTab(t.id)}
                  >
                    {t.label}
                    {t.count > 0 && <span>{t.count}</span>}
                  </button>
                ))}
              </div>
              <button
                disabled={detailLoading}
                className="text-button file-button"
                onClick={() =>
                  setModal({ type: person.file ? "original" : "missing" })
                }
              >
                <Paperclip size={15} />
                {person.file ? "查看原件" : "原件待补充"}
              </button>
            </div>
            {detailLoading ? (
              <Empty title="正在读取候选人详情" body="请稍候…" />
            ) : detailError ? (
              <Empty
                title="详情读取失败"
                body={detailError}
                action={
                  <Button
                    onClick={() => run(async () => {}, "已重新读取", false)}
                  >
                    重试
                  </Button>
                }
              />
            ) : detailTab === "resume" ? (
              <div className="resume-layout">
                <article className="resume-paper">
                  <Resume p={person} text={resumeText} />
                  <div className="paper-foot">
                    <span>数据库简历 · {person.name}</span>
                    <span>{person.file ? "已关联附件" : "原件待补充"}</span>
                  </div>
                </article>
                <aside className="match-panel">
                  <div className="panel-label">
                    <Sparkle size={17} />
                    <b>AI 匹配参考</b>
                  </div>
                  <div className="match-score">
                    <strong>{app?.score ?? "—"}</strong>
                    {app?.score != null && <span>/ 100</span>}
                  </div>
                  <div className="score-caption">
                    {job
                      ? `依据 ${job.name} JD v${app.jdVersion || jd?.version}`
                      : "关联岗位后进行匹配"}
                  </div>
                  {app?.score != null ? (
                    <>
                      <div className="mini-divider" />
                      <h4>{app.verdict || "匹配结论"}</h4>
                      <p>{app.aiSummary || app.reason || "暂无评估说明"}</p>
                      {(app.hits || []).map((hit, i) => (
                        <div className="evidence-item" key={i}>
                          <CheckCircle size={16} />
                          <div>
                            <b>{hit}</b>
                          </div>
                        </div>
                      ))}
                      {[...(app.misses || []), ...(app.concerns || [])].map(
                        (miss, i) => (
                          <div className="evidence-item caution" key={i}>
                            <WarningCircle size={16} />
                            <div>
                              <span>{miss}</span>
                            </div>
                          </div>
                        ),
                      )}
                      <small>评估时间：{dateText(app.screenedAt)}</small>
                    </>
                  ) : (
                    <div className="no-score">
                      <p>
                        {app
                          ? "当前岗位尚未评估，请先查看 JD 和简历。"
                          : "候选人还没有关联岗位。"}
                      </p>
                    </div>
                  )}
                  {app && (
                    <Button
                      disabled={busy || !!app.jobState || c.interviewer}
                      icon={Sparkle}
                      onClick={screenMatch}
                    >
                      {app.jobState
                        ? "匹配任务进行中"
                        : app.score == null
                          ? "生成匹配参考"
                          : "按最新 JD 重新匹配"}
                    </Button>
                  )}
                  <small className="ai-disclaimer">
                    AI 辅助判断，是否推进由 HR
                    决定。未配置模型时，后端采用关键词规则并标明结果。
                  </small>
                </aside>
              </div>
            ) : detailTab === "activity" ? (
              <div className="activity-page">
                <div className="section-heading">
                  <h3>每一次沟通，都有迹可循</h3>
                  <Button
                    disabled={busy}
                    icon={Plus}
                    onClick={() => setModal({ type: "note" })}
                  >
                    添加跟进
                  </Button>
                </div>
                <div className="timeline">
                  {person.followups.map((f) => (
                    <div className="timeline-item" key={f.id}>
                      <span className="timeline-point yellow" />
                      <div>
                        <div className="timeline-title">
                          <b>{f.userName}添加跟进</b>
                          <time>{dateText(f.createdAt)}</time>
                        </div>
                        <p>{f.content}</p>
                        {f.nextStep && <p>下一步：{f.nextStep}</p>}
                      </div>
                    </div>
                  ))}
                  {interviews
                    .filter((i) => i.candidateId === person.id)
                    .map((i) => (
                      <div className="timeline-item" key={i.id}>
                        <span className="timeline-point" />
                        <div>
                          <div className="timeline-title">
                            <b>
                              {i.status === "canceled"
                                ? "面试已取消"
                                : "已安排" + i.round}
                            </b>
                            <time>{dateText(i.startAt)}</time>
                          </div>
                          <p>
                            {i.positionTitle} ·{" "}
                            {i.interviewers.map((u) => u.name).join("、")}
                          </p>
                        </div>
                      </div>
                    ))}
                  <div className="timeline-item">
                    <span className="timeline-point" />
                    <div>
                      <div className="timeline-title">
                        <b>简历进入人才库</b>
                        <time>{dateText(person.createdAt)}</time>
                      </div>
                      <p>
                        {person.source} ·{" "}
                        {person.file ? "已关联附件" : "待补充原附件"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <FeedbackPanel c={c} />
            )}
          </section>
        )}
      </div>
    </>
  );
}

function FeedbackPanel({ c }) {
  const {
    person,
    job,
    interviews,
    feedbackInterview,
    setFeedbackInterview,
    run,
    api,
    busy,
    schedule,
    offer,
  } = c;
  const relevant = interviews.filter(
    (i) =>
      i.candidateId === person.id &&
      (!job || i.positionId === job.id) &&
      i.status !== "canceled",
  );
  const interview =
    relevant.find((i) => i.id === feedbackInterview) || relevant[0];
  const fb = interview?.feedback;
  const save = (event, confirm) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form),
      values = {
        scores: [{ dimension: "综合评价", score: Number(data.get("score")) }],
        note: data.get("note"),
        conclusion: data.get("conclusion"),
      };
    run(
      () =>
        confirm
          ? api.confirmFeedback(interview.id, values)
          : api.saveFeedback(interview.id, values),
      confirm ? "面试评价已确认" : "面评草稿已保存",
      false,
    );
  };
  return (
    <div className="feedback-page">
      <div className="section-heading">
        <div>
          <h3>用真实交流，补全简历之外的信息</h3>
          <p>每份评价关联具体的岗位与面试轮次。</p>
        </div>
        <Badge>人工面评</Badge>
      </div>
      {!interview ? (
        <Empty
          title="该岗位还没有面试安排"
          body="先安排面试，再记录本轮评分和观察。"
          action={<Button onClick={() => schedule()}>安排面试</Button>}
        />
      ) : (
        <>
          <label>
            评价对应的面试
            <select
              aria-label="选择面评轮次"
              value={interview.id}
              onChange={(e) => setFeedbackInterview(e.target.value)}
            >
              {relevant.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.positionTitle} · {i.round} · {dateText(i.startAt)}
                </option>
              ))}
            </select>
          </label>
          <form
            key={interview.id + ":" + (fb?.updatedAt || "")}
            onSubmit={(e) => save(e, false)}
          >
            <fieldset disabled={busy || !!fb?.confirmedAt}>
              <div className="field-row">
                <label>
                  面试结论
                  <select
                    name="conclusion"
                    defaultValue={fb?.conclusion || "待定"}
                  >
                    <option>通过</option>
                    <option>待定</option>
                    <option>不通过</option>
                  </select>
                </label>
                <label>
                  综合评分
                  <select
                    name="score"
                    defaultValue={fb?.scores?.[0]?.score || ""}
                    required
                  >
                    <option value="">请选择</option>
                    {[5, 4, 3, 2, 1].map((v) => (
                      <option key={v} value={v}>
                        {v} 分
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                面试观察与依据
                <textarea
                  name="note"
                  rows="6"
                  required
                  defaultValue={fb?.note || ""}
                  placeholder="记录实际回答、能力证据，以及需要进一步确认的问题。"
                />
              </label>
              <div className="feedback-foot">
                <p>
                  <NotePencil size={15} />
                  记录人工评分与备注
                </p>
                <Button type="submit">保存草稿</Button>
                <Button
                  kind="navy"
                  type="button"
                  onClick={(e) =>
                    save(
                      {
                        preventDefault() {},
                        currentTarget: e.currentTarget.closest("form"),
                      },
                      true,
                    )
                  }
                >
                  确认评价
                </Button>
              </div>
            </fieldset>
          </form>
          {fb?.confirmedAt && !c.interviewer && (
            <div className="intent-card">
              <div>
                <b>面评已确认 · {fb.conclusion}</b>
                <p>
                  {dateText(fb.confirmedAt)} · {fb.interviewerName}
                </p>
              </div>
              <Button
                kind="primary"
                disabled={busy || !job}
                icon={ArrowRight}
                onClick={offer}
              >
                确认意向并发起录取
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function InterviewView({ c }) {
  const {
    interviews,
    people,
    scheduleTab,
    setScheduleTab,
    schedule,
    openPerson,
    setModal,
    run,
    api,
    busy,
    go,
  } = c;
  const list = interviews.filter(
    (i) =>
      scheduleTab === "all" || !["canceled", "completed"].includes(i.status),
  );
  return (
    <div className="calendar-page">
      <div className="content-toolbar">
        <div className="segmented">
          <button
            className={scheduleTab === "upcoming" ? "active" : ""}
            onClick={() => setScheduleTab("upcoming")}
          >
            待进行
          </button>
          <button
            className={scheduleTab === "all" ? "active" : ""}
            onClick={() => setScheduleTab("all")}
          >
            全部安排
          </button>
        </div>
        <Button
          icon={Plus}
          kind="primary"
          disabled={busy || c.interviewer}
          onClick={() => schedule()}
        >
          安排面试
        </Button>
      </div>
      <div className="schedule-layout">
        <section className="schedule-list">
          {!list.length ? (
            <Empty
              title="暂时没有面试安排"
              body="从人才详情中选定岗位，安排下一次交流。"
              action={<Button onClick={() => go("talent")}>去人才库</Button>}
            />
          ) : (
            list.map((i) => {
              const p = people.find((x) => x.id === i.candidateId),
                date = new Date(i.startAt);
              return (
                <article className="interview-card" key={i.id}>
                  <div className="interview-date">
                    <span>{date.getMonth() + 1} 月</span>
                    <strong>{date.getDate()}</strong>
                    <small>
                      {date.toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </small>
                  </div>
                  <div className="interview-info">
                    <div className="interview-title">
                      <button onClick={() => openPerson(i.candidateId)}>
                        {i.candidateName}
                        <ArrowUpRight size={16} />
                      </button>
                      <Badge
                        tone={
                          i.status === "canceled"
                            ? "muted"
                            : i.status === "completed"
                              ? "green"
                              : "yellow"
                        }
                      >
                        {
                          {
                            scheduled: "已安排",
                            rescheduled: "已改期",
                            canceled: "已取消",
                            completed: "面试完成",
                          }[i.status]
                        }
                      </Badge>
                    </div>
                    <p>
                      {i.positionTitle} · {i.round}
                    </p>
                    <div className="interview-meta">
                      <span>
                        <VideoCamera size={15} />
                        {i.mode === "online" ? "线上面试" : "现场面试"}
                      </span>
                      <span>
                        <Users size={15} />
                        {i.interviewers.map((u) => u.name).join("、") ||
                          "未分配面试官"}
                      </span>
                      <span>
                        <Clock size={15} />
                        {Math.round((new Date(i.endAt) - date) / 60000)} 分钟
                      </span>
                    </div>
                    {i.location && <p>{i.location}</p>}
                    {safeAttachmentUrl(i.meetingUrl) && (
                      <a
                        className="text-button"
                        href={safeAttachmentUrl(i.meetingUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        进入会议 ↗
                      </a>
                    )}
                    <div className="notification-states">
                      {Object.entries(i.notify || {}).map(
                        ([channel, state]) => (
                          <span key={channel} title={state.error || ""}>
                            {
                              {
                                feishu: "飞书日程",
                                email: "邮件",
                                sms: "短信",
                              }[channel]
                            }
                            ：{NOTIFY_STATES[state.state] || state.state}
                            {state.error && `（${state.error}）`}
                            {["email", "sms"].includes(channel) &&
                              state.state === "failed" && (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    run(
                                      () => api.resendInterview(i.id, channel),
                                      "已重新发送通知",
                                      false,
                                    )
                                  }
                                >
                                  重试
                                </button>
                              )}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="interview-buttons">
                    {!c.interviewer &&
                      !["canceled", "completed"].includes(i.status) && (
                        <>
                          <button
                            disabled={busy || !p}
                            className="text-button"
                            onClick={() => schedule(p, i)}
                          >
                            改期
                          </button>
                          <button
                            disabled={busy}
                            className="text-button"
                            onClick={() =>
                              setModal({ type: "cancel", interview: i })
                            }
                          >
                            取消
                          </button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  api.patchInterview(i.id, {
                                    action: "complete",
                                  }),
                                "面试已标记完成",
                                false,
                              )
                            }
                          >
                            标记完成
                          </Button>
                        </>
                      )}
                    <Button
                      disabled={i.status === "canceled"}
                      kind="navy"
                      onClick={() =>
                        openPerson(
                          i.candidateId,
                          "feedback",
                          i.positionId,
                          i.id,
                        )
                      }
                    >
                      {i.feedback?.confirmedAt ? "查看面评" : "填写面评"}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>
        <aside className="side-note">
          <span className="note-kicker">面试前的小提醒</span>
          <h3>
            好的交流，
            <br />
            从准备充分开始。
          </h3>
          {[
            "确认岗位与关联 JD",
            "提前查看简历及待核实点",
            "确认双方时间及入会方式",
          ].map((t) => (
            <div className="check-note" key={t}>
              <CheckCircle size={18} />
              <p>{t}</p>
            </div>
          ))}
          <p className="side-note-foot">
            日程与通知的实际结果
            <br />
            可在每条面试安排中查看。
          </p>
        </aside>
      </div>
    </div>
  );
}

export function OfferView({ c }) {
  const { offers, setModal, integrations, run, busy } = c;
  return (
    <div className="offers-page">
      <div className="sub-intro">
        <p>业务确认录取意向后发起。飞书审批与 BPM 的进展分别跟踪。</p>
        <Button
          disabled={busy}
          icon={ArrowClockwise}
          onClick={() => run(async () => {}, "列表已刷新", false)}
        >
          刷新列表
        </Button>
      </div>
      {integrations &&
        (!integrations.feishu.approval || integrations.bpm.mode === "mock") && (
          <div className="form-notice">
            {!integrations.feishu.approval
              ? "飞书审批未配置，后端使用模拟审批。"
              : ""}{" "}
            {integrations.bpm.mode === "mock" ? "BPM 当前为模拟模式。" : ""}
          </div>
        )}
      <div className="offer-list">
        {!offers.length ? (
          <Empty
            title="还没有录取申请"
            body="确认候选人的面试评价与录取意向后，可发起申请。"
          />
        ) : (
          offers.map((o) => (
            <button
              className="offer-card"
              key={o.id}
              onClick={() => setModal({ type: "offer-view", offerId: o.id })}
            >
              <div className="offer-person">
                <span className="avatar">{o.candidateName?.[0] || "?"}</span>
                <div>
                  <h3>
                    {o.candidateName}
                    <span>{o.positionTitle}</span>
                  </h3>
                  <p>
                    {o.id} · {dateText(o.createdAt)} · {o.createdByName}
                  </p>
                </div>
                <Badge tone={o.overall === "approved" ? "green" : "yellow"}>
                  {SIDE_STATES[o.overall]}
                </Badge>
              </div>
              <div className="approval-grid">
                <div>
                  <span>
                    飞书审批
                    {o.feishu.instanceId?.startsWith("MOCK-") ? "（模拟）" : ""}
                  </span>
                  <b>{SIDE_STATES[o.feishu.state]}</b>
                </div>
                <div>
                  <span>
                    BPM 内部 OA
                    {o.bpm.processId?.startsWith("MOCK-") ? "（模拟）" : ""}
                  </span>
                  <b>{SIDE_STATES[o.bpm.state]}</b>
                </div>
                <ArrowUpRight size={20} />
              </div>
            </button>
          ))
        )}
      </div>
      <div className="quiet-note">
        <FileText size={18} />
        <p>
          单个系统通过不代表整体录取流程完成；异常与退回请在申请详情中查看。
        </p>
      </div>
    </div>
  );
}

export function JobsView({ c }) {
  const {
    jobs,
    jds,
    jdTab,
    setJDTab,
    jobQuery,
    setJobQuery,
    setModal,
    setJobFilter,
    setStage,
    setView,
    run,
    busy,
    api,
  } = c;
  const visibleJobs = jobs.filter((j) =>
    [j.name, j.dept].join(" ").includes(jobQuery),
  );
  return (
    <div className="jobs-page">
      <div className="content-toolbar">
        <div className="segmented">
          <button
            className={jdTab === "jobs" ? "active" : ""}
            onClick={() => setJDTab("jobs")}
          >
            岗位 <span>{jobs.length}</span>
          </button>
          <button
            className={jdTab === "jds" ? "active" : ""}
            onClick={() => setJDTab("jds")}
          >
            JD 文档 <span>{jds.length}</span>
          </button>
        </div>
        <div className="search-field compact">
          <MagnifyingGlass size={18} />
          <input
            aria-label="搜索岗位或JD"
            placeholder="搜索岗位或 JD"
            value={jobQuery}
            onChange={(e) => setJobQuery(e.target.value)}
          />
        </div>
      </div>
      {jdTab === "jobs" ? (
        <div className="job-grid">
          {!visibleJobs.length && (
            <Empty
              title="暂无匹配的岗位"
              body="新建岗位并填写 JD 后，即可关联候选人。"
            />
          )}
          {visibleJobs.map((j) => {
            const jd = jds.find((x) => x.id === j.jd);
            return (
              <article className="job-card" key={j.id}>
                <div className="job-topline">
                  <span className="job-dept">{j.dept}</span>
                  <Badge tone={j.status === "open" ? "green" : ""}>
                    {
                      { open: "招聘中", paused: "已暂停", closed: "已关闭" }[
                        j.status
                      ]
                    }
                  </Badge>
                </div>
                <h2>{j.name}</h2>
                <div className="job-location">
                  <MapPin size={15} />
                  {j.location}
                </div>
                <p className="job-intro">{jd?.intro}</p>
                <button
                  className="job-jd-link"
                  onClick={() => setModal({ type: "jd-view", jd })}
                >
                  <FileText size={19} />
                  <span>
                    {jd?.title}
                    <small>岗位 JD · v{jd?.version}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
                <div className="job-card-foot">
                  <span>{j.stats?.total || 0} 位关联人才</span>
                  <button
                    onClick={() => {
                      setJobFilter(j.id);
                      setStage("全部人才");
                      setView("talent");
                    }}
                  >
                    查看人选 <ArrowRight size={16} />
                  </button>
                </div>
                <div className="job-management">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      setModal({ type: "position-edit", position: j })
                    }
                  >
                    编辑岗位
                  </Button>
                  <select
                    aria-label={"岗位状态 " + j.name}
                    value={j.status}
                    disabled={busy}
                    onChange={(e) =>
                      run(
                        () =>
                          api.patchPosition(j.id, { status: e.target.value }),
                        "岗位状态已更新",
                        false,
                      )
                    }
                  >
                    <option value="open">招聘中</option>
                    <option value="paused">暂停招聘</option>
                    <option value="closed">已关闭</option>
                  </select>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="jd-list">
          {!jds.length && (
            <Empty
              title="还没有 JD"
              body="创建 JD 模板，或在新建岗位时填写岗位 JD。"
            />
          )}
          {jds
            .filter((j) => j.title.includes(jobQuery))
            .map((jd) => (
              <article className="jd-row" key={jd.id}>
                <span className="jd-document-icon">
                  <FileText size={25} />
                </span>
                <div>
                  <h3>{jd.title}</h3>
                  <p>
                    {jd.kind === "position"
                      ? `岗位 JD · v${jd.version}`
                      : "JD 模板"}{" "}
                    · {jd.updated} 更新
                  </p>
                </div>
                <Button onClick={() => setModal({ type: "jd-view", jd })}>
                  查看 JD
                </Button>
                <Button
                  disabled={jd.readonly}
                  icon={NotePencil}
                  onClick={() => setModal({ type: "jd-edit", jd })}
                >
                  编辑
                </Button>
              </article>
            ))}
        </div>
      )}
      <div className="relationship-note">
        <LinkSimple size={20} />
        <div>
          <b>岗位关联 JD，候选人关联岗位。</b>
          <p>
            新建岗位复制所选 JD 作为独立版本。更新岗位 JD
            保留历史版本，模板更新用于之后创建的岗位。
          </p>
        </div>
      </div>
    </div>
  );
}
