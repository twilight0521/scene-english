import { useState } from "react";
import {
  ArrowLeft,
  Check,
  FileJson,
  LockKeyhole,
  Save,
  Send,
  ShieldCheck,
  Eye,
  History,
} from "lucide-react";
import { api, post } from "../api";
import { SceneArt } from "./SceneArt";
import type { Lesson } from "../../shared/types";
interface Version {
  id: string;
  version: number;
  status: string;
  published: number;
  data: Lesson;
}
interface AdminData {
  versions: Version[];
  stats: { learners: number; sessions: number; recordings: number };
  feedback: { data: string; created: string }[];
}
const checks = [
  "目标可通过行为验证",
  "语言前置依赖已核对",
  "视觉与音频含义一致",
  "可接受表达与追问已检查",
  "有不同实例或信息变化",
  "教学与迁移题库分离",
  "素材来源和使用方式已确认",
  "错误、权限与故障分支已试用",
];
export default function Admin({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<AdminData | null>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Version | null>(null),
    [json, setJson] = useState(""),
    [review, setReview] = useState<boolean[]>(Array(8).fill(false)),
    [preview, setPreview] = useState(false);
  async function load() {
    setData(await api<AdminData>("/admin/content"));
  }
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function select(v: Version) {
    setSelected(v);
    setJson(JSON.stringify(v.data, null, 2));
    setReview(Array(8).fill(false));
    setMessage("");
    setPreview(false);
  }
  return (
    <div className="admin-page">
      <button className="back-button" onClick={onExit}>
        <ArrowLeft size={18} />
        返回学习
      </button>
      <div className="page-heading">
        <div className="eyebrow">BEHIND THE SCENES</div>
        <h1>让每一课，都值得开口。</h1>
        <p>课程内容、审核与发布。已开始的学习始终保留原内容版本。</p>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}
      {!data ? (
        <form
          className="admin-login panel"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await post("/admin/login", { password });
              await load();
            });
          }}
        >
          <LockKeyhole size={30} />
          <h2>内容管理后台</h2>
          <p>使用服务器配置的管理密码登录。未配置时，后台保持关闭。</p>
          <label>
            管理密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="button primary" disabled={busy}>
            进入后台
            <ArrowLeft size={17} />
          </button>
        </form>
      ) : (
        <>
          <div className="admin-stats">
            {[
              ["学习者", data.stats.learners],
              ["学习会话", data.stats.sessions],
              ["临时录音", data.stats.recordings],
            ].map(([k, v]) => (
              <div key={k}>
                <strong>{v}</strong>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <div className="admin-layout">
            <aside className="panel version-list">
              <h3>
                <History size={18} /> 课程与历史版本
              </h3>
              {data.versions.map((v) => (
                <button
                  key={`${v.id}-${v.version}`}
                  onClick={() => select(v)}
                  className={
                    selected?.id === v.id && selected.version === v.version
                      ? "selected"
                      : ""
                  }
                >
                  <span>
                    {v.data.title}
                    <small>
                      {v.id} · v{v.version}
                    </small>
                  </span>
                  <i>
                    {v.published
                      ? "已发布"
                      : v.status === "reviewed"
                        ? "已审核"
                        : "待审核"}
                  </i>
                </button>
              ))}
            </aside>
            <section className="panel editor-panel">
              {selected ? (
                <>
                  <div className="editor-top">
                    <div>
                      <span className="eyebrow">
                        {selected.id} · VERSION {selected.version}
                      </span>
                      <h2>{selected.data.title}</h2>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setPreview((v) => !v)}
                    >
                      <Eye size={16} />
                      {preview ? "编辑内容" : "预览课程"}
                    </button>
                  </div>
                  {preview ? (
                    <div className="content-preview">
                      <SceneArt scene={selected.data.scene} />
                      <h3>{selected.data.task.goal}</h3>
                      <p>{selected.data.task.opening}</p>
                      <ul>
                        {selected.data.expressions.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                      <hr />
                      <h3>迁移目标（独立题库）</h3>
                      <p>{selected.data.transfer.goal}</p>
                      <small>
                        使用系统插画组件与设备语音合成；课程脚本为试点内容，须完成人工审核后正式发布。
                      </small>
                    </div>
                  ) : (
                    <>
                      <label className="json-label">
                        <FileJson size={16} /> 课程定义 · 保存将创建新草稿
                      </label>
                      <textarea
                        className="json-editor"
                        spellCheck={false}
                        value={json}
                        onChange={(e) => setJson(e.target.value)}
                      />
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const l = await post<Lesson>(
                              "/admin/content",
                              JSON.parse(json),
                            );
                            await load();
                            select({
                              id: l.id,
                              version: l.version,
                              data: l,
                              status: "draft",
                              published: 0,
                            });
                            setMessage(`已保存 v${l.version} 草稿。`);
                          })
                        }
                      >
                        <Save size={17} />
                        保存为新版本
                      </button>
                    </>
                  )}
                  <div className="review-checklist">
                    <h3>
                      <ShieldCheck size={19} />
                      人工发布审核
                    </h3>
                    {checks.map((c, i) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={review[i]}
                          onChange={(e) =>
                            setReview((v) =>
                              v.map((x, j) => (j === i ? e.target.checked : x)),
                            )
                          }
                        />
                        {c}
                      </label>
                    ))}
                    <div className="editor-actions">
                      <button
                        className="button secondary"
                        disabled={busy || !review.every(Boolean)}
                        onClick={() =>
                          act(async () => {
                            await post(
                              `/admin/content/${selected.id}/${selected.version}/review`,
                              { checks: review },
                            );
                            await load();
                            setSelected({ ...selected, status: "reviewed" });
                            setMessage("审核已记录，可以发布此版本。");
                          })
                        }
                      >
                        <Check size={17} />
                        标为审核通过
                      </button>
                      <button
                        className="button primary"
                        disabled={busy || selected.status !== "reviewed"}
                        onClick={() =>
                          act(async () => {
                            await post(
                              `/admin/content/${selected.id}/${selected.version}/publish`,
                              {},
                            );
                            await load();
                            setMessage(
                              `已发布 v${selected.version}。学习中的历史版本不受影响。`,
                            );
                          })
                        }
                      >
                        <Send size={17} />
                        {selected.published ? "重新发布" : "发布此版本"}
                      </button>
                    </div>
                    <small>回滚：选择一个已审核的历史版本，再发布即可。</small>
                  </div>
                </>
              ) : (
                <div className="empty-editor">
                  <FileJson size={35} />
                  <h3>选择一节课，开始查看</h3>
                  <p>草稿通过八项审核后才可发布。</p>
                </div>
              )}
            </section>
          </div>
          {data.feedback.length > 0 && (
            <section className="panel">
              <h3>试学反馈</h3>
              {data.feedback.map((f, i) => (
                <div className="feedback-item" key={i}>
                  <small>{new Date(f.created).toLocaleString("zh-CN")}</small>
                  <p>{JSON.parse(f.data).text}</p>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
