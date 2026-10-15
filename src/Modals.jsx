import React, { useEffect, useRef, useState } from "react";
import { Button, Badge, I } from "./UI";
import {
  dateInput,
  dateText,
  interviewTimes,
  safeAttachmentUrl,
  SIDE_STATES,
} from "./adapters.mjs";
const {
  X,
  CalendarCheck,
  EnvelopeSimple,
  FileText,
  Buildings,
  NotePencil,
  ArrowRight,
  ArrowClockwise,
} = I;

export function Modals({ c }) {
  const {
    modal,
    setModal,
    person,
    job,
    jobs,
    jds,
    people,
    offers,
    interviews,
    run,
    busy,
    api,
    users,
    user,
    setView,
    setJDTab,
    setJobFilter,
    openPerson,
  } = c;
  const dialog = useRef(null);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    const old = document.activeElement,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("input,textarea,select,button")?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      old?.focus?.();
    };
  }, [modal.type]);
  const close = () => {
    if (!busy) setModal(null);
  };
  const submit = (action) => async (e) => {
    e.preventDefault();
    setLocalError("");
    try {
      await action(new FormData(e.currentTarget));
    } catch (error) {
      setLocalError(error.message);
    }
  };
  const trap = (e) => {
    if (e.key !== "Tab") return;
    const elements = [
      ...e.currentTarget.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
      ),
    ].filter((x) => x.getClientRects().length);
    if (!elements.length) {
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === elements[0]) {
      e.preventDefault();
      elements.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === elements.at(-1)) {
      e.preventDefault();
      elements[0].focus();
    }
  };
  const actions = (label = "保存") => (
    <div className="modal-actions">
      <Button onClick={close}>取消</Button>
      <Button disabled={busy} type="submit" kind="primary">
        {busy ? "正在保存…" : label}
      </Button>
    </div>
  );
  const schedulePerson = people.find((p) => p.id === modal.person) || person;
  const existing = modal.existing;
  const offerRecord = offers.find((o) => o.id === modal.offerId);
  const scheduleSave = submit(async (data) => {
    const times = interviewTimes(
      data.get("date"),
      data.get("time"),
      data.get("duration"),
    );
    const success = await run(
      () =>
        existing
          ? api.patchInterview(existing.id, {
              action: "reschedule",
              ...times,
              reason: data.get("note"),
            })
          : api.createInterview({
              candidateId: schedulePerson.id,
              positionId: data.get("job"),
              round: data.get("round"),
              mode: data.get("mode"),
              ...times,
              location: data.get("location"),
              interviewerIds: data.getAll("interviewers"),
              idempotencyKey: modal.idempotencyKey,
            }),
      existing ? "面试已改期" : "面试已安排，通知结果可在面试列表查看",
    );
    if (success) setView("interviews");
  });
  const saveJd = submit(async (data) => {
    const old = modal.jd,
      values = {
        title: data.get("title"),
        content: data.get("duties"),
        requirements: data.get("must"),
      };
    const success = await run(
      () =>
        old?.positionId
          ? api.patchPosition(old.positionId, {
              title: values.title,
              jd: {
                content: values.content,
                requirements: values.requirements,
                note: data.get("bonus"),
              },
            })
          : old?.libraryId
            ? api.updateJd(old.libraryId, {
                ...values,
                company: data.get("intro"),
              })
            : api.addJd({ ...values, company: data.get("intro") }),
      "JD 已保存",
    );
    if (success) setJDTab("jds");
  });
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialog}
        className={
          "modal " +
          (["jd-view", "original", "offer-view"].includes(modal.type)
            ? "wide"
            : "")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={trap}
      >
        <button
          disabled={busy}
          className="close-button"
          aria-label="关闭弹窗"
          onClick={close}
        >
          <X size={21} />
        </button>
        {localError && (
          <p className="form-notice" role="alert">
            {localError}
          </p>
        )}
        {modal.type === "schedule" && (
          <>
            <div className="modal-eyebrow">面试安排</div>
            <h2 id="modal-title">
              {existing ? "调整面试时间" : "留一个时间，好好聊聊"}
            </h2>
            <p className="modal-subtitle">
              {schedulePerson.name} · 日程和通知将在同一处跟进
            </p>
            <form onSubmit={scheduleSave}>
              <fieldset disabled={busy}>
                <label>
                  应聘岗位
                  <select
                    name="job"
                    required
                    disabled={!!existing}
                    defaultValue={
                      existing?.positionId ||
                      schedulePerson.apps.find((a) => a.job === job?.id)?.job ||
                      schedulePerson.apps[0]?.job
                    }
                  >
                    {schedulePerson.apps.map((a) => (
                      <option key={a.job} value={a.job}>
                        {jobs.find((j) => j.id === a.job)?.name ||
                          a.positionTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-row">
                  <label>
                    日期
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={
                        existing
                          ? dateInput(new Date(existing.startAt))
                          : dateInput()
                      }
                    />
                  </label>
                  <label>
                    开始时间
                    <input
                      type="time"
                      name="time"
                      required
                      defaultValue={
                        existing
                          ? new Date(existing.startAt)
                              .toTimeString()
                              .slice(0, 5)
                          : "14:00"
                      }
                    />
                  </label>
                  <label>
                    时长
                    <select
                      name="duration"
                      defaultValue={
                        existing
                          ? String(
                              Math.round(
                                (new Date(existing.endAt) -
                                  new Date(existing.startAt)) /
                                  60000,
                              ),
                            )
                          : "45"
                      }
                    >
                      {[
                        ...new Set([
                          30,
                          45,
                          60,
                          90,
                          ...(existing
                            ? [
                                Math.round(
                                  (new Date(existing.endAt) -
                                    new Date(existing.startAt)) /
                                    60000,
                                ),
                              ]
                            : []),
                        ]),
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v} 分钟
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="field-row">
                  <label>
                    面试官
                    <select
                      name="interviewers"
                      multiple
                      required
                      disabled={!!existing}
                      defaultValue={
                        existing
                          ? existing.interviewers.map((i) => i.id)
                          : [user.id]
                      }
                    >
                      {[
                        ...new Map(
                          [{ id: user.id, name: user.name }, ...users].map(
                            (u) => [u.id, u],
                          ),
                        ).values(),
                      ].map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <small>可按 Ctrl 多选</small>
                  </label>
                  <label>
                    轮次
                    <select
                      name="round"
                      disabled={!!existing}
                      defaultValue={existing?.round || "一面"}
                    >
                      {[
                        ...new Set([
                          "一面",
                          "二面",
                          "终面",
                          "HR 面",
                          ...(existing ? [existing.round] : []),
                        ]),
                      ].map((round) => (
                        <option key={round}>{round}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  面试方式
                  <select
                    name="mode"
                    disabled={!!existing}
                    defaultValue={existing?.mode || "online"}
                  >
                    <option value="online">线上面试</option>
                    <option value="offline">现场面试</option>
                  </select>
                </label>
                <label>
                  地点 / 会议说明
                  <input
                    name="location"
                    disabled={!!existing}
                    defaultValue={existing?.location || ""}
                    placeholder="线下面试地点或线上会议说明"
                  />
                </label>
                {existing && (
                  <label>
                    改期原因
                    <textarea name="note" rows="2" required />
                  </label>
                )}
                <div className="integration-line">
                  <CalendarCheck size={18} />
                  <span>飞书日程</span>
                  <EnvelopeSimple size={17} />
                  <span>候选人通知</span>
                </div>
                <div className="form-notice">
                  {existing
                    ? "保存后更新已有日程。"
                    : "提交后由后端创建日程，并按已有配置发送邮件 / 短信。"}
                  未配置或发送失败会显示在面试列表中。
                </div>
                {actions(existing ? "保存改期" : "保存并安排面试")}
              </fieldset>
            </form>
          </>
        )}
        {modal.type === "note" && (
          <>
            <div className="modal-eyebrow">候选人跟进</div>
            <h2 id="modal-title">记下这次沟通</h2>
            <p className="modal-subtitle">
              {person.name} · 团队可在授权范围内查看
            </p>
            <form
              onSubmit={submit((data) =>
                run(
                  () =>
                    api.addFollowUp(person.id, {
                      content: data.get("content"),
                      nextStep: data.get("nextStep"),
                    }),
                  "跟进记录已保存",
                ),
              )}
            >
              <fieldset disabled={busy}>
                <label>
                  沟通内容
                  <textarea
                    name="content"
                    rows="6"
                    required
                    placeholder="候选人的意向、沟通情况，以及下一步需要做什么。"
                  />
                </label>
                <label>
                  下一步
                  <input
                    name="nextStep"
                    placeholder="例如：周五再次确认到岗时间"
                  />
                </label>
                {actions("保存跟进")}
              </fieldset>
            </form>
          </>
        )}
        {modal.type === "offer" && (
          <>
            <div className="modal-eyebrow">录取流程</div>
            <h2 id="modal-title">确认意向，发起录取申请</h2>
            <p className="modal-subtitle">
              {person.name} · {job?.name}
            </p>
            <form
              onSubmit={submit((data) =>
                run(
                  () =>
                    api.createOffer({
                      candidateId: person.id,
                      positionId: job.id,
                      note: data.get("reason"),
                      idempotencyKey: modal.idempotencyKey,
                    }),
                  "录取申请已创建",
                ).then((success) => {
                  if (success) setView("offers");
                }),
              )}
            >
              <fieldset disabled={busy}>
                <label>
                  拟录取岗位
                  <input readOnly value={job?.name || ""} />
                </label>
                <label>
                  录取意见与依据
                  <textarea
                    name="reason"
                    rows="4"
                    required
                    defaultValue={
                      interviews.find(
                        (i) =>
                          i.candidateId === person.id &&
                          i.positionId === job?.id &&
                          i.feedback?.confirmedAt,
                      )?.feedback?.note || ""
                    }
                  />
                </label>
                <div className="approval-systems">
                  <div>
                    <FileText size={21} />
                    <b>飞书审批</b>
                    <span>关联申请与处理状态</span>
                  </div>
                  <div>
                    <Buildings size={21} />
                    <b>BPM 内部 OA</b>
                    <span>衔接公司录取流程</span>
                  </div>
                </div>
                <div className="form-notice">
                  提交会调用后端发起录取申请。
                  {c.integrations?.feishu.approval
                    ? "飞书审批已配置。"
                    : "飞书审批是否实际发起以申请详情为准；未配置时后端使用模拟审批。"}{" "}
                  {c.integrations
                    ? `BPM 当前模式：${c.integrations.bpm.mode}。`
                    : ""}
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" required />
                  我已确认业务录取意向，并核对岗位与面试评价。
                </label>
                {actions("确认并发起申请")}
              </fieldset>
            </form>
          </>
        )}
        {modal.type === "offer-view" && offerRecord && (
          <>
            <div className="modal-eyebrow">录取申请 · {offerRecord.id}</div>
            <h2 id="modal-title">{offerRecord.candidateName}的录取流程</h2>
            <p className="modal-subtitle">
              {offerRecord.positionTitle} · 负责人 {offerRecord.createdByName}
            </p>
            <div className="offer-reason">
              <span>录取意见</span>
              <p>{offerRecord.note}</p>
            </div>
            {["feishu", "bpm"].map((side) => (
              <div className="system-status-row" key={side}>
                <FileText size={24} />
                <div>
                  <b>{side === "feishu" ? "飞书审批" : "BPM 内部 OA"}</b>
                  <p>
                    {offerRecord[side].instanceId ||
                      offerRecord[side].processId ||
                      "尚未发起"}
                  </p>
                  {offerRecord[side].error && (
                    <p role="alert">{offerRecord[side].error}</p>
                  )}
                </div>
                <Badge
                  tone={
                    offerRecord[side].state === "approved" ? "green" : "yellow"
                  }
                >
                  {SIDE_STATES[offerRecord[side].state]}
                </Badge>
              </div>
            ))}
            <div className="approval-history">
              {offerRecord.history.map((h, i) => (
                <p key={i}>
                  {dateText(h.at)} · {h.detail}
                </p>
              ))}
            </div>
            <div className="modal-actions">
              <Button
                disabled={busy}
                onClick={() => {
                  close();
                  openPerson(
                    offerRecord.candidateId,
                    "feedback",
                    offerRecord.positionId,
                  );
                }}
              >
                查看面试评价
              </Button>
              {!["approved", "canceled"].includes(offerRecord.overall) && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    setModal({ type: "offer-cancel", offerId: offerRecord.id })
                  }
                >
                  撤销申请
                </Button>
              )}
              <Button
                disabled={busy}
                icon={ArrowClockwise}
                kind="navy"
                onClick={() =>
                  run(
                    () => api.refreshOffer(offerRecord.id),
                    "审批状态已更新",
                    false,
                  )
                }
              >
                查询最新审批状态
              </Button>
            </div>
          </>
        )}
        {modal.type === "offer-cancel" && (
          <>
            <div className="modal-eyebrow">录取流程</div>
            <h2 id="modal-title">确认撤销录取申请？</h2>
            <p className="modal-subtitle">
              撤销将调用后端更新飞书与 BPM 中可撤销的流程。
            </p>
            <div className="modal-actions">
              <Button
                disabled={busy}
                onClick={() =>
                  setModal({ type: "offer-view", offerId: modal.offerId })
                }
              >
                返回申请
              </Button>
              <Button
                disabled={busy}
                kind="primary"
                onClick={() =>
                  run(
                    () => api.cancelOffer(modal.offerId),
                    "申请撤销结果已更新",
                  )
                }
              >
                确认撤销
              </Button>
            </div>
          </>
        )}
        {modal.type === "jd-view" && modal.jd && (
          <>
            <div className="modal-eyebrow">
              {modal.jd.positionId
                ? "岗位 JD · v" + modal.jd.version
                : "JD 模板"}
            </div>
            <h2 id="modal-title">{modal.jd.title}</h2>
            <p className="modal-subtitle">{modal.jd.intro}</p>
            <div className="jd-reading">
              {[
                { name: "工作职责", value: modal.jd.duties },
                { name: "任职要求", value: modal.jd.must },
                { name: "备注 / 补充要求", value: modal.jd.bonus },
              ].map((s) => (
                <section key={s.name}>
                  <h3>{s.name}</h3>
                  <ul>
                    {(s.value || "未填写")
                      .split("\n")
                      .filter(Boolean)
                      .map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="jd-version-note">
              岗位 JD 更新保留历史版本；模板用于新建岗位时复制。
            </div>
            <div className="modal-actions">
              <Button
                disabled={modal.jd.readonly}
                icon={NotePencil}
                onClick={() => setModal({ type: "jd-edit", jd: modal.jd })}
              >
                编辑 JD
              </Button>
              <Button kind="navy" onClick={close}>
                完成
              </Button>
            </div>
          </>
        )}
        {modal.type === "jd-edit" && (
          <>
            <div className="modal-eyebrow">岗位与 JD</div>
            <h2 id="modal-title">
              {modal.jd ? "更新岗位要求" : "写一份清晰的 JD"}
            </h2>
            <p className="modal-subtitle">
              {modal.jd?.positionId
                ? "保存后建立岗位 JD 的新版本。"
                : "保存为 JD 模板，新建岗位时可直接选用。"}
            </p>
            <form onSubmit={saveJd}>
              <fieldset disabled={busy}>
                <label>
                  JD 名称
                  <input
                    name="title"
                    required
                    defaultValue={modal.jd?.title || ""}
                  />
                </label>
                {!modal.jd?.positionId && (
                  <label>
                    模板说明
                    <input name="intro" defaultValue={modal.jd?.intro || ""} />
                  </label>
                )}
                <label>
                  工作职责
                  <textarea
                    rows="4"
                    name="duties"
                    required
                    defaultValue={modal.jd?.duties || ""}
                  />
                </label>
                <label>
                  任职要求
                  <textarea
                    rows="4"
                    name="must"
                    defaultValue={modal.jd?.must || ""}
                  />
                </label>
                {modal.jd?.positionId && (
                  <label>
                    备注 / 补充要求
                    <textarea
                      rows="2"
                      name="bonus"
                      defaultValue={modal.jd?.bonus || ""}
                    />
                  </label>
                )}
                {actions(modal.jd ? "保存 JD" : "创建 JD 模板")}
              </fieldset>
            </form>
          </>
        )}
        {["job", "position-edit"].includes(modal.type) && (
          <PositionForm c={c} close={close} />
        )}
        {modal.type === "attach" && (
          <>
            <div className="modal-eyebrow">人岗关联</div>
            <h2 id="modal-title">为{person.name}关联岗位</h2>
            <p className="modal-subtitle">
              关联后由后台针对岗位 JD 执行初筛，保留其他岗位的评估。
            </p>
            {jobs.filter(
              (j) =>
                j.status === "open" && !person.apps.some((a) => a.job === j.id),
            ).length ? (
              <form
                onSubmit={submit((data) =>
                  run(
                    () => api.addMatch(person.id, data.get("job")),
                    "岗位已关联，后台正在生成匹配参考",
                  ).then((success) => {
                    if (success) setJobFilter(data.get("job"));
                  }),
                )}
              >
                <fieldset disabled={busy}>
                  <label>
                    选择岗位
                    <select name="job" required defaultValue="">
                      <option value="" disabled>
                        选择一个在招岗位
                      </option>
                      {jobs
                        .filter(
                          (j) =>
                            j.status === "open" &&
                            !person.apps.some((a) => a.job === j.id),
                        )
                        .map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name} · JD v
                            {jds.find((x) => x.id === j.jd)?.version}
                          </option>
                        ))}
                    </select>
                  </label>
                  {actions("关联岗位与 JD")}
                </fieldset>
              </form>
            ) : (
              <div className="form-notice">
                没有可关联的在招岗位。请先创建岗位，或检查岗位是否已关联。
              </div>
            )}
          </>
        )}
        {modal.type === "original" && (
          <>
            <div className="modal-eyebrow">简历原附件</div>
            <h2 id="modal-title">{person.name}的简历附件</h2>
            <p className="modal-subtitle">读取数据库中关联的附件地址。</p>
            <div className="attachment-list">
              {person.attachments
                .filter((a) => a.url)
                .map((a) => {
                  const url = safeAttachmentUrl(a.url);
                  return (
                    <div key={a.id}>
                      <FileText size={20} />
                      <span>{a.name || "简历附件"}</span>
                      {url ? (
                        <a
                          className="button navy"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          打开原件 <ArrowRight size={16} />
                        </a>
                      ) : (
                        <span>附件地址无效，请联系管理员</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}
        {modal.type === "missing" && (
          <>
            <div className="modal-eyebrow">附件状态</div>
            <h2 id="modal-title">原附件还没有入库</h2>
            <p className="modal-subtitle">当前可查看数据库提供的简历正文。</p>
            <div className="form-notice">
              可记录跟进，向候选人索要原附件，由采集侧或管理员补充入库。
            </div>
            <div className="modal-actions">
              <Button kind="primary" onClick={() => setModal({ type: "note" })}>
                记录待补充事项
              </Button>
            </div>
          </>
        )}
        {modal.type === "cancel" && (
          <>
            <div className="modal-eyebrow">取消面试</div>
            <h2 id="modal-title">确认取消这次面试？</h2>
            <p className="modal-subtitle">
              {modal.interview.candidateName} ·{" "}
              {dateText(modal.interview.startAt)}
            </p>
            <form
              onSubmit={submit((data) =>
                run(
                  () =>
                    api.patchInterview(modal.interview.id, {
                      action: "cancel",
                      reason: data.get("reason"),
                    }),
                  "面试已取消",
                ),
              )}
            >
              <fieldset disabled={busy}>
                <label>
                  取消原因
                  <textarea name="reason" required rows="3" />
                </label>
                {actions("确认取消")}
              </fieldset>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function PositionForm({ c, close }) {
  const { modal, jds, api, run, busy, setJDTab } = c,
    old = modal.position;
  const existing = jds.find((j) => j.id === old?.jd);
  const [duties, setDuties] = useState(existing?.duties || ""),
    [must, setMust] = useState(existing?.must || ""),
    [bonus, setBonus] = useState(existing?.bonus || "");
  const [error, setError] = useState("");
  const save = async (e) => {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const values = {
        title: data.get("title"),
        department: data.get("dept"),
        city: data.get("city"),
        jd: { content: duties, requirements: must, note: bonus },
      };
      const success = await run(
        () =>
          old ? api.patchPosition(old.id, values) : api.createPosition(values),
        old ? "岗位已更新" : "岗位已创建",
      );
      if (success) setJDTab("jobs");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <div className="modal-eyebrow">岗位管理</div>
      <h2 id="modal-title">{old ? "更新岗位" : "开启一个新岗位"}</h2>
      <p className="modal-subtitle">填写清晰的岗位要求，让每次匹配有据可依。</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            岗位名称
            <input name="title" required defaultValue={old?.name || ""} />
          </label>
          <div className="field-row">
            <label>
              所属团队
              <input
                name="dept"
                defaultValue={old?.dept === "团队未填写" ? "" : old?.dept || ""}
              />
            </label>
            <label>
              工作地点
              <input
                name="city"
                defaultValue={
                  old?.location === "地点未填写" ? "" : old?.location || ""
                }
              />
            </label>
          </div>
          <label>
            选用已有 JD{" "}
            <span className="optional">选填，会复制为独立岗位版本</span>
            <select
              aria-label="选用已有 JD"
              defaultValue=""
              onChange={(e) => {
                const jd = jds.find((j) => j.id === e.target.value);
                if (jd) {
                  setDuties(jd.duties);
                  setMust(jd.must);
                  setBonus(jd.bonus);
                }
              }}
            >
              <option value="">手动填写岗位 JD</option>
              {jds.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} · {j.positionId ? "v" + j.version : "模板"}
                </option>
              ))}
            </select>
          </label>
          <label>
            工作职责
            <textarea
              rows="4"
              required
              value={duties}
              onChange={(e) => setDuties(e.target.value)}
            />
          </label>
          <label>
            任职要求
            <textarea
              rows="3"
              value={must}
              onChange={(e) => setMust(e.target.value)}
            />
          </label>
          <label>
            备注 / 补充要求
            <textarea
              rows="2"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <Button onClick={close}>取消</Button>
            <Button disabled={busy} kind="primary" type="submit">
              {old ? "保存岗位" : "创建岗位"}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
