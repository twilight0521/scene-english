import { useState } from "react";
import { ArrowLeft, Check, Volume2, WifiOff } from "lucide-react";
import type { Lesson } from "../../shared/types";
import { SceneArt } from "./SceneArt";
import { speak } from "../api";
import { Recorder } from "./Recorder";
export default function OfflinePractice({
  lesson,
  onExit,
}: {
  lesson: Lesson;
  onExit: () => void;
}) {
  const [answer, setAnswer] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="lesson-page">
      <button className="back-button" onClick={onExit}>
        <ArrowLeft size={18} />
        返回课程
      </button>
      <div className="page-heading">
        <div className="eyebrow">
          <WifiOff size={14} />A QUIET OFFLINE MOMENT
        </div>
        <h1>{lesson.title}</h1>
        <p>离线练习 · 课程内容已缓存。本次练习不保存进度、不计入口语评估。</p>
      </div>
      <div className="learning-layout">
        <section>
          <div className="scene-stage">
            <SceneArt
              scene={lesson.scene}
              variant={lesson.scene === "foundation" ? lesson.order * 2 : 0}
            />
          </div>
          <div className="intro-panel">
            <div className="expression-row">
              {lesson.expressions.map((e) => (
                <button
                  key={e}
                  onClick={() =>
                    speak(e, 0.8, () =>
                      setError("设备语音暂时不可用，可以继续查看文字。"),
                    )
                  }
                >
                  <Volume2 size={18} />
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="listen-drop">
            <Volume2 size={22} />
            <span>{lesson.concept.prompt}</span>
          </div>
          <div className="choices">
            {lesson.concept.options.map((o) => (
              <button key={o.value} onClick={() => setAnswer(o.value)}>
                <span className="choice-emoji">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
          {answer && (
            <p
              className={
                answer === lesson.concept.answer
                  ? "success-message"
                  : "wrong-message"
              }
              role="status"
            >
              {answer === lesson.concept.answer
                ? "✓ That’s it. Try saying it out loud."
                : "Listen once more. Give it another try."}
            </p>
          )}
          <Recorder onReady={() => {}} onError={setError} />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="lesson-aside" style={{ paddingTop: 0 }}>
          <div className="goal-card">
            <div className="eyebrow">YOUR LITTLE MISSION</div>
            <div className="goal-icons">
              {lesson.task.icons.map((icon, i) => (
                <span key={i}>{icon}</span>
              ))}
            </div>
            <h3>{lesson.task.goal}</h3>
            <p>
              录音只在本页回放，离开页面即释放，不会上传。网络恢复后可进入完整课程。
            </p>
          </div>
          <button
            className="button secondary"
            style={{ marginTop: 20, width: "100%" }}
            onClick={onExit}
          >
            <Check size={17} />
            返回我的学习空间
          </button>
        </aside>
      </div>
    </div>
  );
}
