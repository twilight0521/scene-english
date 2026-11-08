import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  Compass,
  Download,
  Flame,
  Headphones,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Volume2,
  X,
  Menu,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import type {
  AppData,
  Lesson,
  Learner,
  Session,
  SceneId,
} from "../shared/types";
import { SCENES } from "../shared/content";
import { abilityStatus } from "../shared/engine";
import { api, post } from "./api";
import { useDialogFocus } from "./components/useDialogFocus";
import { SceneArt } from "./components/SceneArt";
import OfflinePractice from "./components/OfflinePractice";
import Learning from "./components/Learning";
import Admin from "./components/Admin";
import Onboarding from "./components/Onboarding";
const navItems = [
  { id: "today", label: "今天", en: "Today", icon: Sun },
  { id: "scenes", label: "探索场景", en: "Scenes", icon: Compass },
  { id: "review", label: "温故知新", en: "Practice", icon: RotateCcw },
  { id: "profile", label: "我的旅程", en: "My journey", icon: BookOpen },
];
const iconMap = { Coffee, ShoppingBag, MapPin, Users };
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <MessageCircle size={24} strokeWidth={1.7} />
        <i />
      </span>
      <span>
        scene<span className="brand-light">english</span>
        <small>让英语，发生在生活里</small>
      </span>
    </div>
  );
}
const pageFromHash = () => {
  const h = window.location.hash.slice(1);
  return ["today", "scenes", "review", "profile", "admin"].includes(h)
    ? h
    : "today";
};
export default function App() {
  const [data, setData] = useState<AppData | null>(null),
    [page, setPage] = useState(pageFromHash),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState<Session | null>(null),
    [offlineLesson, setOfflineLesson] = useState<Lesson | null>(null),
    [onboard, setOnboard] = useState(false),
    [sceneFilter, setSceneFilter] = useState<SceneId | "all">("all"),
    [account, setAccount] = useState(false),
    [authMode, setAuthMode] = useState<"register" | "login">("register"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [toast, setToast] = useState(""),
    [recordings, setRecordings] = useState<
      { id: string; created: number; mime: string }[]
    >([]),
    [confirmDelete, setConfirmDelete] = useState(false),
    [menu, setMenu] = useState(false),
    [feedback, setFeedback] = useState(false),
    [feedbackText, setFeedbackText] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  useDialogFocus(onboard || account || confirmDelete || feedback, () => {
    setOnboard(false);
    setAccount(false);
    setConfirmDelete(false);
    setFeedback(false);
  });
  async function refresh() {
    try {
      const d = await api<AppData>("/today");
      setData(d);
      try {
        localStorage.setItem(
          "scene-english-catalog-v1",
          JSON.stringify(d.lessons),
        );
      } catch {}
      return d;
    } catch (e) {
      if (!navigator.onLine) {
        let lessons: Lesson[] = [];
        try {
          lessons = JSON.parse(
            localStorage.getItem("scene-english-catalog-v1") || "[]",
          );
        } catch {}
        if (lessons.length) {
          const cached: AppData = {
            learner: {
              id: "offline",
              name: "离线学习者",
              email: null,
              settings: {
                immersion: "strict",
                subtitles: true,
                rate: 1,
                onboarded: true,
                goal: "daily",
                level: "beginner",
              },
            },
            lessons,
            sessions: [],
            reviews: [],
            evidence: [],
            asrAvailable: false,
            adminEnabled: false,
          };
          setData(cached);
          return cached;
        }
      }
      throw e;
    }
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const hash = () => {
      setPage(pageFromHash());
      setActive(null);
      setError("");
      setMenu(false);
    };
    const net = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh().catch((e) => setError(e.message));
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (page === "profile" && data)
      api<typeof recordings>("/recordings")
        .then(setRecordings)
        .catch((e) => setError(e.message));
  }, [page, data?.learner.id]);
  function go(id: string) {
    window.location.hash = id;
    setPage(id);
    setActive(null);
    setMenu(false);
    setError("");
    window.scrollTo(0, 0);
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(lesson: Lesson, reviewId?: string) {
    if (!navigator.onLine) {
      setOfflineLesson(lesson);
      return;
    }
    await act(async () => {
      const s = await post<Session>("/sessions", {
        lessonId: lesson.id,
        reviewId,
      });
      setActive(s);
      setOnboard(false);
      window.scrollTo(0, 0);
    });
  }
  async function settings(patch: Partial<Learner["settings"]>) {
    await act(async () => {
      const l = await api<Learner>("/learner", {
        method: "PATCH",
        body: JSON.stringify({ settings: patch }),
      });
      setData((d) => (d ? { ...d, learner: l } : d));
    });
  }
  if (!data)
    return (
      <div className="loading-page">
        <Logo />
        {error ? (
          <>
            <h2>暂时没能连接到学习空间</h2>
            <p>{error}</p>
            <button
              className="button primary"
              onClick={() => {
                setError("");
                refresh().catch((e) => setError(e.message));
              }}
            >
              重新连接
              <RotateCcw size={18} />
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={30} />
            <p>正在为你打开一个新场景…</p>
          </>
        )}
      </div>
    );
  const completed = new Set(
    data.sessions.filter((s) => s.completed).map((s) => s.lessonId),
  );
  const current = data.sessions
    .filter((s) => !s.completed)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const next =
    data.lessons.find((l) => !completed.has(l.id)) || data.lessons[4];
  const featured = current?.lesson || next;
  const due = data.reviews.filter((r) => new Date(r.due) <= new Date());
  const dailyDone = data.sessions.filter(
    (s) =>
      s.completed &&
      new Date(s.updatedAt).toLocaleDateString("en-CA", {
        timeZone: "Asia/Shanghai",
      }) ===
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }),
  ).length;
  const selectedScene = SCENES.find((s) => s.id === featured.scene);
  const totalMinutes = data.sessions
    .filter((s) => s.completed)
    .reduce((n, s) => n + s.lesson.minutes, 0);
  if (offlineLesson)
    return (
      <OfflinePractice
        lesson={offlineLesson}
        onExit={() => {
          setOfflineLesson(null);
          if (navigator.onLine) refresh().catch((e) => setError(e.message));
        }}
      />
    );
  if (active)
    return (
      <Learning
        key={active.id}
        initial={active}
        data={data}
        onExit={() => {
          setActive(null);
          refresh().catch((e) => setError(e.message));
        }}
        onUpdate={() => {
          refresh().catch((e) => setError(e.message));
        }}
      />
    );
  if (page === "admin") return <Admin onExit={() => go("today")} />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Logo />
        <div className="sidebar-section-label">YOUR LITTLE ENGLISH WORLD</div>
        <nav aria-label="主导航">
          {navItems.map(({ id, label, en, icon: Icon }) => (
            <button
              className={`nav-item ${page === id ? "active" : ""}`}
              key={id}
              onClick={() => go(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={20} />
              <span>
                {label}
                <small>{en}</small>
              </span>
              {id === "review" && due.length > 0 ? (
                <b>{due.length}</b>
              ) : page === id ? (
                <span className="nav-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-sprout">
            <Leaf size={30} />
            <Sparkles size={16} />
          </div>
          <h4>
            Small steps.
            <br />
            Real conversations.
          </h4>
          <p>
            每天一点点，
            <br />
            让生活里的英语自然发生。
          </p>
          <span>A MOMENT FOR YOURSELF</span>
        </div>
        <button className="sidebar-feedback" onClick={() => setFeedback(true)}>
          <MessageCircle size={18} />
          <span>分享一点想法</span>
          <ArrowUpRight size={15} />
        </button>
        <button className="profile-chip" onClick={() => go("profile")}>
          <span className="avatar">
            {data.learner.email ? data.learner.email[0].toUpperCase() : "G"}
          </span>
          <span>
            {data.learner.email ? data.learner.name : "你好，探索者"}
            <small>
              {data.learner.email ? "你的学习空间" : "访客学习 · 自动保存"}
            </small>
          </span>
          <MoreHorizontal size={18} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu((v) => !v)}
            >
              <Menu size={22} />
            </button>
            <Logo />
          </div>
          <div className="breadcrumb">
            你的英语小世界 <ChevronRight size={13} />
            <strong>{navItems.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="pilot-badge">
              <span className="status-dot" /> EARLY EXPLORER
            </span>
            <button
              className="icon-button"
              aria-label="Learning settings"
              onClick={() => go("profile")}
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {!online && (
            <div className="alert" role="status">
              网络已断开。可打开课程进行离线理解与录音回放练习；进度需联网保存。
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {page === "today" && (
            <>
              <div className="dashboard-heading">
                <div>
                  <div className="eyebrow">
                    <span className="tiny-sun">✳</span>{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                      timeZone: "Asia/Shanghai",
                    })
                      .format(new Date())
                      .toUpperCase()}
                  </div>
                  <h1>
                    世界很大，
                    <br className="mobile-break" />
                    从一句 <i>Hello</i> 开始
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>给自己十分钟，走进一个英语发生的小场景。</p>
                </div>
                <span className="handwritten">
                  A little English,
                  <br />a little every day.
                  <svg viewBox="0 0 100 25">
                    <path
                      d="M4 15Q38 0 92 13m-15-8 15 8-18 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
              </div>
              <div className="dashboard-top">
                <section className="hero-card">
                  <div className="hero-copy">
                    <div className="tag">
                      <span />{" "}
                      {current
                        ? "CONTINUE YOUR MOMENT"
                        : "YOUR NEXT LITTLE ADVENTURE"}
                    </div>
                    <span className="hero-overline">
                      {featured.scene === "foundation"
                        ? "A gentle beginning"
                        : selectedScene?.en}
                    </span>
                    <h2>
                      {featured.scene === "foundation"
                        ? "从第一杯水，\n走进英语世界。"
                        : featured.scene === "cafe"
                          ? "一杯咖啡，\n一段小小的对话。"
                          : featured.scene === "shop"
                            ? "喜欢的东西，\n自己开口带回家。"
                            : featured.scene === "directions"
                              ? "下一个路口，\n试着开口问问。"
                              : "新的朋友，\n从你好开始。"}
                    </h2>
                    <p>
                      {featured.title} <span>·</span> {featured.minutes} 分钟
                    </p>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        !data.learner.settings.onboarded
                          ? setOnboard(true)
                          : start(featured)
                      }
                    >
                      {current ? "继续这个场景" : "走进这个场景"}
                      <ArrowRight size={18} />
                    </button>
                    <small>
                      <Headphones size={13} /> 先听懂，再慢慢开口
                    </small>
                  </div>
                  <div className="hero-art">
                    <SceneArt scene={featured.scene} />
                    <span className="art-sticker">
                      <Coffee size={17} />
                      {featured.scene === "foundation"
                        ? "One small beginning."
                        : "A moment in real life."}
                    </span>
                  </div>
                </section>
                <aside className="today-card">
                  <div className="card-eyebrow">
                    TODAY, AT YOUR PACE <Sun size={18} />
                  </div>
                  <h3>不赶路，也在前进。</h3>
                  <p>一个场景，就是今天的小目标。</p>
                  <div className="daily-ring">
                    <svg viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="51" />
                      <circle
                        className="ring-fill"
                        cx="60"
                        cy="60"
                        r="51"
                        strokeDasharray={`${dailyDone ? 320 : 0} 320`}
                      />
                    </svg>
                    <div>
                      <strong>
                        {dailyDone ? 1 : 0}
                        <small>/ 1</small>
                      </strong>
                      <span>今日小目标</span>
                    </div>
                    <span className="ring-leaf">
                      <Leaf size={21} />
                    </span>
                  </div>
                  <div className="today-foot">
                    <span className="soft-icon">
                      <Check size={15} />
                    </span>
                    {dailyDone
                      ? "已经完成，留一点时间给自己。"
                      : "从一次轻松的对话开始。"}
                  </div>
                </aside>
              </div>
              <section className="scene-section">
                <div className="section-title">
                  <div>
                    <h2>
                      把英语，放回生活里 <span>Find your scene</span>
                    </h2>
                    <p>选一个熟悉的地方，让每句话都有画面。</p>
                  </div>
                  <button className="text-button" onClick={() => go("scenes")}>
                    全部场景
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="scene-grid">
                  {SCENES.map((scene, i) => {
                    const count = data.lessons.filter(
                      (l) => l.scene === scene.id && completed.has(l.id),
                    ).length;
                    const Icon = iconMap[scene.icon as keyof typeof iconMap];
                    return (
                      <button
                        key={scene.id}
                        className={`scene-card ${scene.color}`}
                        onClick={() => {
                          setSceneFilter(scene.id);
                          go("scenes");
                        }}
                      >
                        <div className="scene-card-art">
                          <SceneArt scene={scene.id} />
                          <span className="scene-number">0{i + 1}</span>
                          <span className="scene-mini-icon">
                            <Icon size={18} />
                          </span>
                        </div>
                        <div className="scene-card-copy">
                          <span className="scene-en">{scene.en}</span>
                          <h3>
                            {scene.name}
                            <ArrowUpRight size={18} />
                          </h3>
                          <p>{scene.ability}</p>
                          <div className="scene-progress">
                            <div>
                              <i style={{ width: `${count * 25}%` }} />
                            </div>
                            <span>{count} / 4</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
              <div className="dashboard-bottom">
                <section className="review-callout">
                  <div className="review-callout-icon">
                    <RotateCcw size={25} />
                    <i>✦</i>
                  </div>
                  <div>
                    <div className="eyebrow">LET IT STAY WITH YOU</div>
                    <h3>
                      {due.length
                        ? "和昨天的自己，再聊两句。"
                        : "学过的，会在合适的时候再见。"}
                    </h3>
                    <p>
                      {due.length
                        ? `${due.length} 个小练习已到期，换个画面，再自然一点。`
                        : "完成一课后，我们会为你安排下一次练习。"}
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => go("review")}
                  >
                    {due.length ? "开始复习" : "看看复习计划"}
                    <ArrowRight size={17} />
                  </button>
                </section>
                <div className="quiet-quote">
                  <span>“</span>
                  <p>
                    You don’t have to be perfect.
                    <br />
                    You just have to begin.
                  </p>
                  <small>给今天的你</small>
                </div>
              </div>
              <footer className="page-footer">
                <span>
                  <Leaf size={14} /> A little progress is still progress.
                </span>
                <span>SCENE ENGLISH · MADE FOR REAL LIFE</span>
              </footer>
            </>
          )}
          {page === "scenes" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">LIFE IS YOUR CLASSROOM</div>
                <h1>下一句英语，会发生在哪里？</h1>
                <p>
                  4 节基础课，4 个生活场景。按顺序走，或者从你最想去的地方开始。
                </p>
              </div>
              <div className="filter-tabs" role="group" aria-label="筛选场景">
                {[
                  ["all", "全部场景"],
                  ["foundation", "基础桥接"],
                  ...SCENES.map((s) => [s.id, s.name]),
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={sceneFilter === id ? "active" : ""}
                    onClick={() => setSceneFilter(id as typeof sceneFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(["foundation", ...SCENES.map((s) => s.id)] as SceneId[])
                .filter((id) => sceneFilter === "all" || sceneFilter === id)
                .map((id) => (
                  <section className="lesson-group" key={id}>
                    <div className="lesson-group-title">
                      <span className={`group-icon ${id}`}>
                        {id === "foundation"
                          ? "🌱"
                          : id === "cafe"
                            ? "☕"
                            : id === "shop"
                              ? "👜"
                              : id === "directions"
                                ? "🧭"
                                : "👋"}
                      </span>
                      <div>
                        <h2>
                          {id === "foundation"
                            ? "从零开始，也很自然"
                            : SCENES.find((s) => s.id === id)?.name}
                        </h2>
                        <p>
                          {id === "foundation"
                            ? "看见、听见、尝试。4 个温柔的开始。"
                            : SCENES.find((s) => s.id === id)?.description}
                        </p>
                      </div>
                      <span>4 LESSONS</span>
                    </div>
                    <div className="lesson-list">
                      {data.lessons
                        .filter((l) => l.scene === id)
                        .map((l, i) => (
                          <button
                            className="lesson-row"
                            key={l.id}
                            disabled={busy}
                            onClick={() => start(l)}
                          >
                            <span
                              className={`lesson-order ${completed.has(l.id) ? "done" : ""}`}
                            >
                              {completed.has(l.id) ? (
                                <Check size={19} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <span>
                              <strong>{l.title}</strong>
                              <small>{l.subtitle}</small>
                            </span>
                            <div className="lesson-row-meta">
                              <span>
                                {i === 3 && id !== "foundation"
                                  ? "变化挑战"
                                  : "场景练习"}
                              </span>
                              <small>
                                <Clock size={13} />
                                {l.minutes} min
                              </small>
                            </div>
                            <ArrowRight size={19} />
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
            </>
          )}
          {page === "review" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">MAKE IT PART OF YOU</div>
                <h1>熟悉一点，自然一点。</h1>
                <p>换一个画面，再试一次。今天的练习，会在未来某天帮到你。</p>
              </div>
              <div className="review-summary">
                <div>
                  <RotateCcw size={25} />
                  <strong>{due.length}</strong>
                  <span>现在可以复习</span>
                </div>
                <div>
                  <Clock size={25} />
                  <strong>{data.reviews.length - due.length}</strong>
                  <span>正在等合适的时间</span>
                </div>
                <div>
                  <CheckCircle2 size={25} />
                  <strong>
                    {
                      data.evidence.filter(
                        (e) =>
                          e.kind === "transfer" && e.spoken && e.independent,
                      ).length
                    }
                  </strong>
                  <span>独立口语迁移证据</span>
                </div>
              </div>
              {data.reviews.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-leaves">
                    <Leaf size={48} />
                    <Plus size={18} />
                  </div>
                  <h2>让第一段对话，在这里生根。</h2>
                  <p>
                    完成一课后，复习会在第 1、3、7 天逐步安排。
                    <br />
                    遗忘或使用完整示范后，会更早再见。
                  </p>
                  <button
                    className="button primary"
                    onClick={() => start(next)}
                  >
                    开始一个小场景
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="list-heading">
                    {due.length
                      ? "今天，和这些表达再见面"
                      : "还没到期，也可以提前练习"}
                  </h2>
                  <div className="review-list">
                    {data.reviews
                      .slice()
                      .sort((a, b) => a.due.localeCompare(b.due))
                      .slice(0, 10)
                      .map((r) => {
                        const l = data.lessons.find((l) => l.id === r.lessonId);
                        if (!l) return null;
                        const isDue = new Date(r.due) <= new Date();
                        return (
                          <article className="review-item" key={r.id}>
                            <span className="review-item-icon">
                              {l.transfer.icons[0]}
                            </span>
                            <div>
                              <span className="eyebrow">
                                {isDue
                                  ? "READY WHEN YOU ARE"
                                  : new Date(r.due).toLocaleDateString(
                                      "zh-CN",
                                      { month: "long", day: "numeric" },
                                    ) + " · 计划复习"}
                              </span>
                              <h3>{l.title}</h3>
                              <p>新的任务卡 · 第 {r.repetitions + 1} 次练习</p>
                            </div>
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() => start(l, r.id)}
                            >
                              {isDue ? "再试一次" : "提前练习"}
                              <ArrowRight size={16} />
                            </button>
                          </article>
                        );
                      })}
                  </div>
                  <p className="muted">
                    每天最多展示 10
                    项，留一些时间给新体验。复习使用变化任务，文字练习与口语证据分别记录。
                  </p>
                </>
              )}
            </>
          )}
          {page === "profile" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">YOUR OWN LITTLE JOURNEY</div>
                <h1>每一次开口，都有迹可循。</h1>
                <p>不急着给自己打分。看看你已经走到哪里。</p>
              </div>
              <div className="profile-grid">
                <section className="panel account-panel">
                  <div className="avatar large">
                    {data.learner.email
                      ? data.learner.email[0].toUpperCase()
                      : "G"}
                  </div>
                  <h2>{data.learner.name}</h2>
                  <p>{data.learner.email || "访客学习者 · 进度自动保存"}</p>
                  {!data.learner.email ? (
                    <button
                      className="button primary"
                      onClick={() => setAccount(true)}
                    >
                      保存到我的账号
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={() =>
                        act(async () => {
                          await post("/logout", {});
                          await refresh();
                          setToast("已退出账号。原账号的学习进度仍然保存。");
                        })
                      }
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  )}
                  <small>
                    账号注册会保留访客进度；登录后自动合并当前访客记录。
                  </small>
                </section>
                <section className="panel progress-panel">
                  <h3>
                    你的脚步 <span>Little moments add up</span>
                  </h3>
                  <div className="progress-stats">
                    <div>
                      <strong>
                        {completed.size}
                        <small>/20</small>
                      </strong>
                      <span>体验过的单元</span>
                    </div>
                    <div>
                      <strong>{totalMinutes}</strong>
                      <span>完成课程的计划分钟</span>
                    </div>
                    <div>
                      <strong>
                        {
                          data.evidence.filter((e) => e.spoken && e.independent)
                            .length
                        }
                      </strong>
                      <span>独立口语证据</span>
                    </div>
                  </div>
                  <div className="profile-progress">
                    <i style={{ width: `${completed.size * 5}%` }} />
                  </div>
                  <p>
                    完成学习不等于已经掌握。能力依据不同日期、不同实例的实际表现记录。
                  </p>
                </section>
                <section className="panel ability-panel">
                  <h3>
                    我正在学会 <span>Things I can do</span>
                  </h3>
                  {SCENES.map((sc) => {
                    const e = data.evidence.filter((e) => e.scene === sc.id);
                    const status = abilityStatus(e);
                    return (
                      <div className="ability-row" key={sc.id}>
                        <span>{sc.ability}</span>
                        <small
                          className={status === "independent" ? "verified" : ""}
                        >
                          {status === "independent"
                            ? "已能独立完成"
                            : status === "practising"
                              ? "练习中"
                              : "等待初次尝试"}
                        </small>
                      </div>
                    );
                  })}
                  <p className="muted">
                    至少跨 2 天、3 次无完整示范的口语成功，其中 1
                    次为新实例，才显示独立完成。非 CEFR 等级认证。
                  </p>
                </section>
                <section className="panel settings-panel">
                  <h3>
                    <Settings size={18} />
                    适合你的学习方式
                  </h3>
                  <div className="setting-row">
                    <div>
                      <strong>沉浸模式</strong>
                      <small>学习区默认无中文翻译</small>
                    </div>
                    <select
                      aria-label="沉浸模式"
                      value={data.learner.settings.immersion}
                      disabled={busy}
                      onChange={(e) =>
                        settings({
                          immersion: e.target.value as "strict" | "assisted",
                        })
                      }
                    >
                      <option value="strict">严格沉浸</option>
                      <option value="assisted">辅助沉浸</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>英语字幕</strong>
                      <small>学习时可以随时切换</small>
                    </div>
                    <button
                      className={`toggle ${data.learner.settings.subtitles ? "on" : ""}`}
                      role="switch"
                      aria-checked={data.learner.settings.subtitles}
                      aria-label="英语字幕"
                      disabled={busy}
                      onClick={() =>
                        settings({
                          subtitles: !data.learner.settings.subtitles,
                        })
                      }
                    >
                      <i />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>播放语速</strong>
                      <small>设备语音合成 · 英语</small>
                    </div>
                    <select
                      aria-label="播放语速"
                      value={data.learner.settings.rate}
                      onChange={(e) =>
                        settings({ rate: Number(e.target.value) })
                      }
                      disabled={busy}
                    >
                      <option value={0.65}>慢一些 · 0.65×</option>
                      <option value={0.8}>稍慢 · 0.8×</option>
                      <option value={1}>自然 · 1×</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>重新体验引导</strong>
                      <small>目标、操作演示与起点选择</small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setOnboard(true)}
                    >
                      重新开始
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
                <section className="panel data-panel">
                  <h3>
                    <ShieldCheck size={18} />
                    语音与数据，由你掌握
                  </h3>
                  <p>
                    录音只为本次学习临时保存，24
                    小时内自动删除。删除录音会清除音频文件及其引用，学习文字与评估记录仍保留。
                  </p>
                  <div className="service-state">
                    <span className="status-dot" />
                    {data.asrAvailable
                      ? "语音识别服务已配置；低可信结果需要手动确认。"
                      : "语音识别尚未配置，当前可录音与文字演练。"}
                  </div>
                  {recordings.length > 0 ? (
                    <div className="recordings-list">
                      {recordings.map((r) => (
                        <div key={r.id}>
                          <span>
                            {new Date(r.created).toLocaleString("zh-CN")}
                          </span>
                          <audio
                            src={`/v1/recordings/${r.id}`}
                            controls
                            aria-label="Saved recording"
                          />
                          <button
                            className="icon-button danger"
                            title="删除录音"
                            onClick={() =>
                              act(async () => {
                                await api(`/recordings/${r.id}`, {
                                  method: "DELETE",
                                });
                                setRecordings((v) =>
                                  v.filter((x) => x.id !== r.id),
                                );
                                setToast("录音和引用已删除。");
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-recordings">
                      <Volume2 size={18} />
                      暂无临时保存的录音
                    </div>
                  )}
                  <div className="data-actions">
                    <a className="button secondary" href="/v1/export" download>
                      <Download size={16} />
                      导出学习记录
                    </a>
                    <button
                      className="text-button danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={16} />
                      清除学习数据
                    </button>
                  </div>
                </section>
                <section className="panel notes-panel">
                  <div className="eyebrow">BUILT WITH CARE</div>
                  <h3>这是一个正在生长的学习空间。</h3>
                  <p>
                    20
                    节课程为试点脚本，配图使用原创场景组件，语音来自设备。正式用于教学前，仍需英语教学人员完成内容审核。
                  </p>
                  <button className="text-button" onClick={() => go("admin")}>
                    <LockKeyhole size={16} />
                    内容管理后台
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setFeedback(true)}
                  >
                    分享试学反馈
                    <MessageCircle size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
      {onboard && (
        <Onboarding
          onClose={() => setOnboard(false)}
          onSaved={() => {
            refresh().catch((e) => setError(e.message));
          }}
          onStart={(s) => {
            setOnboard(false);
            setActive(s);
          }}
        />
      )}
      {account && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await post("/auth", { mode: authMode, email, password });
                await refresh();
                setAccount(false);
                setPassword("");
                setToast("账号已保存，继续你的英语旅程。");
              });
            }}
          >
            <button
              type="button"
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setAccount(false)}
            >
              <X size={20} />
            </button>
            <div className="eyebrow">KEEP YOUR LITTLE MOMENTS</div>
            <h2 id="account-title">把每一步，留给未来的你。</h2>
            <p>使用邮箱和密码保存进度。无需接收邮件即可注册。</p>
            <div className="filter-tabs">
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                创建账号
              </button>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                已有账号
              </button>
            </div>
            <label>
              邮箱
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete={
                  authMode === "register" ? "new-password" : "current-password"
                }
                minLength={8}
                maxLength={128}
                placeholder="至少 8 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {authMode === "register"
                ? "创建并保留进度"
                : "登录并合并访客进度"}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <Trash2 size={30} />
            <h2 id="delete-title">清除这段学习记录？</h2>
            <p>
              将删除所有学习会话、评估、复习安排和录音，并重置学习偏好。账号仍会保留。此操作无法撤销。
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setConfirmDelete(false)}
              >
                保留记录
              </button>
              <button
                className="button destructive"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api("/data", { method: "DELETE" });
                    await refresh();
                    setRecordings([]);
                    setConfirmDelete(false);
                    setToast("学习数据已清除。");
                  })
                }
              >
                确认清除
              </button>
            </div>
          </section>
        </div>
      )}
      {feedback && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await post("/feedback", { text: feedbackText });
                setFeedback(false);
                setFeedbackText("");
                setToast("想法已收到，谢谢你陪它一起成长。");
              });
            }}
          >
            <button
              type="button"
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setFeedback(false)}
            >
              <X size={20} />
            </button>
            <MessageCircle size={30} />
            <h2 id="feedback-title">有一点想法，想听你说。</h2>
            <p>哪里让你卡住？哪一句英语，想在生活里用上？</p>
            <textarea
              value={feedbackText}
              minLength={2}
              maxLength={2000}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="写在这里…"
              required
            />
            <button className="button primary" disabled={busy}>
              提交反馈
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
