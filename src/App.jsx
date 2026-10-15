import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Users,
  CalendarBlank,
  FileText,
  Briefcase,
  Plus,
  CaretDown,
  ArrowClockwise,
  Database,
  CheckCircle,
} from "@phosphor-icons/react";
import { api } from "./legacy/api";
import Login from "./legacy/views/Login";
import { ToastHost } from "./legacy/components/Toast";
import { TalentView, InterviewView, OfferView, JobsView } from "./Views";
import { Modals } from "./Modals";
import { Button, Empty } from "./UI";
import {
  STAGES,
  allCandidates,
  candidateModel,
  positionModel,
  positionJd,
  libraryJd,
} from "./adapters.mjs";
const Assist = lazy(() => import("./legacy/views/Assist"));
const Review = lazy(() => import("./legacy/views/Review"));
const Bank = lazy(() => import("./legacy/views/Bank"));
const Admin = lazy(() => import("./legacy/views/Admin"));
const Home = lazy(() => import("./legacy/views/Home"));

const TITLES = {
  talent: "人才与简历",
  interviews: "面试安排",
  offers: "录取流程",
  jobs: "岗位与 JD",
  assist: "面试助手",
  review: "评审详情",
  bank: "题库",
  admin: "管理",
  home: "工作台",
};
const SUBTITLES = {
  talent: "先读懂一个人，再决定下一步。",
  interviews: "把时间对齐，让每一次交流顺畅开始。",
  offers: "录取意向确认之后，让每一步都有回应。",
  jobs: "让岗位要求清晰，也让每一次匹配有据可依。",
};

export function App() {
  const [auth, setAuth] = useState(null),
    [authPending, setAuthPending] = useState(true),
    [authError, setAuthError] = useState("");
  const checkAuth = useCallback(async () => {
    setAuthPending(true);
    setAuthError("");
    try {
      setAuth(await api.me());
    } catch (e) {
      if (e.status !== 401) setAuthError(e.message);
      else setAuth(null);
    } finally {
      setAuthPending(false);
    }
  }, []);
  useEffect(() => {
    void checkAuth();
    const expired = () => setAuth(null);
    window.addEventListener("facetry:unauthorized", expired);
    return () => window.removeEventListener("facetry:unauthorized", expired);
  }, [checkAuth]);
  if (authPending) return <div className="auth-state">正在连接招聘工作台…</div>;
  if (authError)
    return (
      <div className="auth-state">
        <p role="alert">连接后端失败：{authError}</p>
        <button onClick={checkAuth}>重试连接</button>
      </div>
    );
  if (!auth?.user) return <Login onLogin={checkAuth} />;
  return (
    <Workspace
      auth={auth}
      onLogout={async () => {
        await api.logout();
        setAuth(null);
      }}
    />
  );
}

function Workspace({ auth, onLogout }) {
  const { user, groups = [] } = auth;
  const interviewer =
    user.role === "interviewer" && !user.isAdmin && !user.isSuper;
  const [view, setView] = useState(interviewer ? "interviews" : "talent");
  const [rows, setRows] = useState([]),
    [positions, setPositions] = useState([]),
    [library, setLibrary] = useState([]);
  const [interviews, setInterviews] = useState([]),
    [offers, setOffers] = useState([]),
    [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(""),
    [details, setDetails] = useState(null),
    [resumeText, setResumeText] = useState("");
  const [detailError, setDetailError] = useState(""),
    [detailLoading, setDetailLoading] = useState(false);
  const [jobFilter, setJobFilter] = useState("all"),
    [stage, setStage] = useState("全部人才"),
    [query, setQuery] = useState(""),
    [source, setSource] = useState("全部来源");
  const [detailTab, setDetailTab] = useState("resume"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showData, setShowData] = useState(false);
  const [scheduleTab, setScheduleTab] = useState("upcoming"),
    [jdTab, setJDTab] = useState("jobs"),
    [jobQuery, setJobQuery] = useState("");
  const [revision, setRevision] = useState(0),
    [lastRead, setLastRead] = useState(""),
    [integrations, setIntegrations] = useState(null);
  const [feedbackInterview, setFeedbackInterview] = useState(""),
    [sessionId, setSessionId] = useState(""),
    [fromView, setFromView] = useState("assist");
  const timer = useRef(null),
    actionLock = useRef(false),
    mounted = useRef(true);
  const notify = useCallback((message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [candidateRows, ps, js, ivs, os, directory] = await Promise.all([
        allCandidates(api),
        api.listPositions(),
        api.listJds(),
        api.listInterviews(interviewer ? { mine: true } : {}),
        interviewer ? Promise.resolve({ offers: [] }) : api.listOffers(),
        api.listUsers(),
      ]);
      if (!mounted.current) return;
      setRows(candidateRows);
      setPositions(ps.positions);
      setLibrary(js.jds);
      setInterviews(ivs.interviews);
      setOffers(os.offers);
      setUsers(directory.users);
      setSelected((old) =>
        candidateRows.some((c) => c.id === old)
          ? old
          : candidateRows[0]?.id || "",
      );
      setLastRead(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [interviewer]);
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  useEffect(() => {
    if (user.isAdmin)
      api
        .adminIntegrations()
        .then(setIntegrations)
        .catch(() => {});
  }, [user.isAdmin, revision]);

  useEffect(() => {
    let active = true;
    if (!selected) {
      setDetails(null);
      setResumeText("");
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    Promise.all([api.getCandidate(selected), api.resumeText(selected)])
      .then(([detail, text]) => {
        if (active) {
          setDetails(detail);
          setResumeText(text.text);
        }
      })
      .catch((e) => {
        if (active) setDetailError(e.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, revision]);

  const screening =
    details?.candidate.id === selected &&
    details?.matches.some((m) => m.jobState === "screen");
  useEffect(() => {
    if (!screening) return;
    let active = true;
    const refreshMatch = async () => {
      try {
        const detail = await api.getCandidate(selected);
        if (!active) return;
        setDetails(detail);
        setRows((old) =>
          old.map((row) =>
            row.id === selected ? { ...row, matches: detail.matches } : row,
          ),
        );
      } catch (e) {
        if (active) notify(e.message);
      }
    };
    const interval = setInterval(refreshMatch, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [screening, selected, notify]);

  const jobs = useMemo(() => positions.map(positionModel), [positions]);
  const jds = useMemo(
    () => [...positions.map(positionJd), ...library.map(libraryJd)],
    [positions, library],
  );
  const people = useMemo(
    () =>
      rows.map((row) =>
        candidateModel(row, details?.candidate.id === row.id ? details : null),
      ),
    [rows, details],
  );
  const filtered = people.filter(
    (p) =>
      (stage === "全部人才" || p.status === stage) &&
      (jobFilter === "all" || p.apps.some((a) => a.job === jobFilter)) &&
      (source === "全部来源" || p.source === source) &&
      (!query ||
        [p.name, p.company, p.role, ...p.tags]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const person = people.find((p) => p.id === selected),
    app = person?.apps.find((a) => a.job === jobFilter) || person?.apps[0];
  const job = jobs.find((j) => j.id === app?.job),
    jd = jds.find((j) => j.id === job?.jd);
  useEffect(() => {
    if (filtered.length && !filtered.some((p) => p.id === selected)) {
      setSelected(filtered[0].id);
      setDetailTab("resume");
    }
  }, [query, jobFilter, source, stage, filtered.map((p) => p.id).join("|")]);

  const run = async (action, message, close = true) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    try {
      await action();
      if (!mounted.current) return true;
      // Close after the mutation succeeds, even if the subsequent refresh fails.
      if (close) setModal(null);
      try {
        await reload();
      } catch (e) {
        notify(`操作已保存，刷新失败：${e.message}`);
        return true;
      }
      if (message) notify(message);
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const waitJob = async (initial) => {
    let current = initial;
    for (
      let attempt = 0;
      current.state === "running" && attempt < 120;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!mounted.current) return;
      current = await api.getJob(current.id);
    }
    if (current.state === "error")
      throw new Error(current.error || "后台任务执行失败");
    if (current.state === "running")
      throw new Error("后台任务仍在运行，请稍后刷新查看结果");
  };
  const go = (next, sid) => {
    if (next === "back") {
      setView(fromView);
      return;
    }
    setFromView(view);
    setSessionId(sid || "");
    setView(
      next === "resumes" || next === "candidate"
        ? "talent"
        : next === "jds"
          ? "jobs"
          : next,
    );
    if (next === "candidate" && sid) setSelected(sid);
    window.scrollTo(0, 0);
  };
  go.from = TITLES[fromView] || "工作台";
  const openPerson = (id, tab = "resume", jobId = "all", interviewId = "") => {
    setSelected(id);
    setStage("全部人才");
    setJobFilter(jobId);
    setSource("全部来源");
    setQuery("");
    setDetailTab(tab);
    setFeedbackInterview(interviewId);
    setView("talent");
  };
  const schedule = (p = person, existing = null) => {
    if (!p) {
      notify("请先在人才库选择候选人");
      return;
    }
    if (!p.apps.length) {
      openPerson(p.id);
      setModal({ type: "attach" });
      notify("请先为候选人关联岗位");
      return;
    }
    setSelected(p.id);
    setModal({
      type: "schedule",
      person: p.id,
      existing,
      idempotencyKey: crypto.randomUUID(),
    });
  };
  const offer = () => {
    if (!person || !job) return;
    if (
      !interviews.some(
        (i) =>
          i.candidateId === person.id &&
          i.positionId === job.id &&
          i.feedback?.confirmedAt,
      )
    ) {
      setDetailTab("feedback");
      notify("请先确认该岗位的面试评价");
      return;
    }
    setModal({
      type: "offer",
      person: person.id,
      idempotencyKey: crypto.randomUUID(),
    });
  };
  const screenMatch = () =>
    app?.id &&
    run(
      async () => {
        await waitJob(await api.screenMatch(app.id));
      },
      "匹配结果已更新",
      false,
    );
  const ctx = {
    view,
    setView,
    people,
    jobs,
    jds,
    person,
    app,
    job,
    jd,
    filtered,
    selected,
    setSelected,
    query,
    setQuery,
    jobFilter,
    setJobFilter,
    source,
    setSource,
    stage,
    setStage,
    detailTab,
    setDetailTab,
    modal,
    setModal,
    interviews,
    offers,
    scheduleTab,
    setScheduleTab,
    jdTab,
    setJDTab,
    jobQuery,
    setJobQuery,
    notify,
    go,
    openPerson,
    schedule,
    offer,
    run,
    busy,
    loading,
    screenMatch,
    api,
    users,
    user,
    interviewer,
    integrations,
    detailError,
    detailLoading: detailLoading || details?.candidate.id !== selected,
    resumeText,
    feedbackInterview,
    setFeedbackInterview,
  };
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape" && !actionLock.current) {
        setModal(null);
        setShowData(false);
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const nav = interviewer
    ? [
        { id: "interviews", name: "我的面试", icon: CalendarBlank },
        { id: "talent", name: "人才与简历", icon: Users },
      ]
    : [
        { id: "talent", name: "人才与简历", icon: Users },
        { id: "interviews", name: "面试安排", icon: CalendarBlank },
        { id: "offers", name: "录取流程", icon: FileText },
        { id: "jobs", name: "岗位与 JD", icon: Briefcase },
      ];
  const businessView = ["talent", "interviews", "offers", "jobs"].includes(
    view,
  );
  return (
    <div className="app" aria-busy={busy}>
      <ToastHost />
      <header className="topbar">
        <a
          className="brand"
          href="#talent"
          onClick={(e) => {
            e.preventDefault();
            go("talent");
          }}
        >
          <span className="brand-mark">
            <img src="./logo.png" alt="知马" />
          </span>
          <strong>知马</strong>
          <span className="brand-sub">人才招聘工作台</span>
        </a>
        <nav aria-label="主导航">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              {n.name}
            </button>
          ))}
        </nav>
        <div className="account">
          <select
            aria-label="工作工具"
            value={
              ["assist", "bank", "admin", "home", "review"].includes(view)
                ? view
                : ""
            }
            onChange={(e) => e.target.value && go(e.target.value)}
          >
            <option value="">工作工具</option>
            <option value="home">原版工作台</option>
            <option value="assist">面试助手</option>
            <option value="bank">题库</option>
            {view === "review" && <option value="review">评审详情</option>}
            {user.isAdmin && <option value="admin">管理</option>}
          </select>
          <span className="avatar small">{user.name?.[0]}</span>
          <span className="account-name">{user.name}</span>
          <button
            disabled={busy}
            onClick={() => onLogout().catch((e) => notify(e.message))}
          >
            退出
          </button>
        </div>
      </header>
      <main className="desk-shell">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {groups[0]?.pathName || "企业招聘"} <span>/</span> 招聘工作空间
            </div>
            <h1>{TITLES[view]}</h1>
            <p>{SUBTITLES[view] || "好问题，就在字里行间。"}</p>
          </div>
          <div className="heading-actions">
            {view === "talent" ? (
              <div className="data-wrap">
                <button
                  className="data-trigger"
                  onClick={() => setShowData(!showData)}
                  aria-expanded={showData}
                >
                  <span className={"status-dot " + (error ? "amber" : "")} />
                  {error
                    ? "数据读取失败"
                    : loading
                      ? "正在读取数据"
                      : "业务数据已连接"}
                  <CaretDown size={13} />
                </button>
                <div className="last-read">
                  {lastRead ? `最近读取 ${lastRead}` : "首次读取中"}
                  <button
                    className={loading ? "spinning icon-button" : "icon-button"}
                    disabled={loading || busy}
                    aria-label="刷新业务数据"
                    onClick={() => run(async () => {}, "数据已刷新", false)}
                  >
                    <ArrowClockwise size={15} />
                  </button>
                </div>
                {showData && (
                  <div className="data-popover">
                    <b>
                      <Database size={18} />
                      数据接入
                    </b>
                    <p>读取现有后端的候选人、附件与岗位数据。</p>
                    {integrations && (
                      <small>
                        来源库：
                        {integrations.sourceDb.configured ? "已配置" : "未配置"}
                        <br />
                        最近同步：{integrations.sourceDb.lastSyncAt || "暂无"}
                        <br />
                        {integrations.sourceDb.lastError}
                      </small>
                    )}
                    {user.isAdmin && (
                      <Button
                        disabled={busy || !integrations?.sourceDb.configured}
                        onClick={() =>
                          run(
                            async () => {
                              await waitJob(await api.adminSync());
                            },
                            "来源数据同步完成",
                            false,
                          )
                        }
                      >
                        {integrations?.sourceDb.configured
                          ? "同步来源库"
                          : "来源库未配置"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : view === "jobs" && !interviewer ? (
              <>
                <Button
                  icon={Plus}
                  onClick={() => setModal({ type: "jd-edit" })}
                >
                  创建 JD
                </Button>
                <Button
                  icon={Plus}
                  kind="primary"
                  onClick={() => setModal({ type: "job" })}
                >
                  新建岗位
                </Button>
              </>
            ) : (
              <div className="heading-note">
                <CalendarBlank size={17} />
                {new Date().toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="connection-error" role="alert">
            读取失败：{error}
            <Button
              disabled={busy}
              onClick={() => run(async () => {}, "数据已刷新", false)}
            >
              重试
            </Button>
          </div>
        )}
        {businessView ? (
          loading && !lastRead ? (
            <Empty title="正在读取业务数据" body="请稍候…" />
          ) : view === "talent" ? (
            <TalentView c={ctx} />
          ) : view === "interviews" ? (
            <InterviewView c={ctx} />
          ) : view === "offers" ? (
            <OfferView c={ctx} />
          ) : (
            <JobsView c={ctx} />
          )
        ) : (
          <div className="legacy-panel">
            <Suspense fallback={<p>正在打开…</p>}>
              {view === "assist" && <Assist go={go} user={user.name} />}{" "}
              {view === "home" && <Home go={go} user={user.name} />}{" "}
              {view === "review" && <Review sessionId={sessionId} go={go} />}{" "}
              {view === "bank" && <Bank />}{" "}
              {view === "admin" && user.isAdmin && <Admin me={user} go={go} />}
            </Suspense>
          </div>
        )}
        <footer className="app-footer">
          <span>仅限企业内部使用</span>
          <span>知马 · 人才招聘工作台</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={20} />
          {toast}
        </div>
      )}
      {busy && (
        <div className="save-progress" role="status">
          正在处理，请稍候…
        </div>
      )}
      {modal && <Modals c={ctx} />}
    </div>
  );
}
