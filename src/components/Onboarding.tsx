import { useState } from "react";
import {
  ArrowRight,
  Check,
  Headphones,
  Plane,
  MessageCircle,
  Volume2,
  X,
} from "lucide-react";
import { post, api, speak } from "../api";
import type { Learner, Session } from "../../shared/types";
export default function Onboarding({
  onClose,
  onStart,
  onSaved,
}: {
  onClose: () => void;
  onStart: (s: Session) => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0),
    [goal, setGoal] = useState("daily"),
    [level, setLevel] = useState("beginner"),
    [played, setPlayed] = useState(false),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function finish() {
    setBusy(true);
    try {
      await api<Learner>("/learner", {
        method: "PATCH",
        body: JSON.stringify({ settings: { goal, level, onboarded: true } }),
      });
      onSaved();
      const s = await post<Session>("/sessions", {
        lessonId:
          level === "returning" && answer === "coffee"
            ? "cafe-1"
            : "foundation-1",
      });
      onStart(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
      >
        <button
          className="modal-close icon-button"
          aria-label="Close introduction"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <div className="onboard-dots">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? "active" : ""} />
          ))}
        </div>
        <div className="eyebrow">A SMALL BEGINNING</div>
        <h2 id="onboard-title">
          {step === 0
            ? "你想在哪里，用上英语？"
            : step === 1
              ? "听一听，轻轻点一下。"
              : "从适合你的一步开始。"}
        </h2>
        <p>
          {step === 0
            ? "不用准备好，带着一个小目标就可以。"
            : step === 1
              ? "先听声音，再选择对应的物品。没有计时，也不需要考试。"
              : "可以从零开始，也可以直接进入场景。之后随时切换。"}
        </p>
        {step === 0 ? (
          <div className="goal-choices">
            {[
              ["daily", "走进日常生活", "点餐、购物、简单交流", Headphones],
              ["travel", "为下一次旅行", "问路、买东西、认识朋友", Plane],
              [
                "social",
                "让对话自然发生",
                "更愿意开口说第一句话",
                MessageCircle,
              ],
            ].map(([value, title, desc, Icon]) => {
              const C = Icon as typeof Headphones;
              return (
                <button
                  key={String(value)}
                  onClick={() => setGoal(String(value))}
                  className={goal === value ? "selected" : ""}
                >
                  <C size={23} />
                  <span>
                    <strong>{String(title)}</strong>
                    <small>{String(desc)}</small>
                  </span>
                  {goal === value && <Check size={18} />}
                </button>
              );
            })}
          </div>
        ) : step === 1 ? (
          <div className="onboard-demo">
            <button
              className={`demo-listen ${played ? "played" : ""}`}
              aria-label="Listen to coffee"
              onClick={() => {
                setPlayed(true);
                speak("Coffee.", 0.8, () =>
                  setError("设备暂时无法播放语音。你可以跳过演示。"),
                );
              }}
            >
              <Volume2 size={35} />
              <span>{played ? "↻" : "▶"}</span>
            </button>
            <div className="demo-options">
              {[
                ["tea", "🍵"],
                ["coffee", "☕"],
                ["water", "💧"],
              ].map(([value, icon]) => (
                <button
                  className={answer === value ? "selected" : ""}
                  key={value}
                  aria-label={value}
                  onClick={() => {
                    setAnswer(value);
                    if (value !== "coffee") setError("再听一次，选择咖啡 ☕。");
                    else setError("");
                  }}
                >
                  {icon}
                  {answer === value && value === "coffee" && (
                    <Check size={18} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="level-choices">
            <button
              className={level === "beginner" ? "selected" : ""}
              onClick={() => setLevel("beginner")}
            >
              <span>🌱</span>
              <strong>从第一杯水开始</strong>
              <small>4 节基础桥接课，用图片和操作建立联系。</small>
            </button>
            <button
              className={level === "returning" ? "selected" : ""}
              onClick={() => setLevel("returning")}
            >
              <span>☕</span>
              <strong>我想直接进入场景</strong>
              <small>通过演示后，可从咖啡店开始。</small>
            </button>
          </div>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy}
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        >
          {step === 2 ? "开始我的第一课" : "继续"}
          <ArrowRight size={18} />
        </button>
        {step === 1 && (
          <button className="text-button" onClick={() => setStep(2)}>
            跳过演示，之后再试
          </button>
        )}
        <small className="onboard-footer">
          不必注册 · 进度自动保存在当前浏览器的访客账号
        </small>
      </section>
    </div>
  );
}
