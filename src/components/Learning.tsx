import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Volume2,
  Lightbulb,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  Keyboard,
  Mic,
  LoaderCircle,
  Flag,
  CheckCircle2,
  MessageCircle,
  X,
} from "lucide-react";
import type { AppData, Session } from "../../shared/types";
import { api, post, speak, ApiError } from "../api";
import { SceneArt } from "./SceneArt";
import { useDialogFocus } from "./useDialogFocus";
import { Recorder } from "./Recorder";
const phases = [
  "Look & listen",
  "Listen & choose",
  "Listen & repeat",
  "Your conversation",
  "A little twist",
];
type PendingVoice = {
  recordingId: string;
  key: string;
  phase: number;
  id?: string;
};
function readPendingVoice(session: Session): PendingVoice | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`voice:${session.id}`) || "null",
    );
    return value?.phase === session.phase ? value : null;
  } catch {
    return null;
  }
}
export default function Learning({
  initial,
  data,
  onExit,
  onUpdate,
}: {
  initial: Session;
  data: AppData;
  onExit: () => void;
  onUpdate: () => void;
}) {
  const [savedVoice] = useState(() => readPendingVoice(initial));
  const voiceRequest = useRef<PendingVoice | null>(savedVoice);
  const previousPhase = useRef(initial.phase);
  function persistVoice(value: PendingVoice | null) {
    voiceRequest.current = value;
    try {
      if (value)
        sessionStorage.setItem(`voice:${initial.id}`, JSON.stringify(value));
      else sessionStorage.removeItem(`voice:${initial.id}`);
    } catch {
      /* Progress remains available from the server. */
    }
  }
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [blob, setBlob] = useState<Blob | null>(null),
    [help, setHelp] = useState(""),
    [helpOpen, setHelpOpen] = useState(false),
    [showText, setShowText] = useState(
      initial.conditions?.subtitles ?? data.learner.settings.subtitles,
    ),
    [typed, setTyped] = useState(false),
    [recordingId, setRecordingId] = useState(savedVoice?.recordingId || ""),
    [job, setJob] = useState<{
      id: string;
      text: string;
      trusted: boolean;
    } | null>(null),
    [history, setHistory] = useState<{ who: string; text: string }[]>([]),
    [wrong, setWrong] = useState(""),
    [processing, setProcessing] = useState(""),
    [feedbackOpen, setFeedbackOpen] = useState(false),
    [report, setReport] = useState("");
  useDialogFocus(feedbackOpen, () => setFeedbackOpen(false));
  const mounted = useRef(true),
    pending = useRef<{
      sessionId: string;
      key: string;
      text?: string;
      answer?: string;
      input: string;
      recordingId?: string;
      jobId?: string;
      skip?: boolean;
    } | null>(null),
    failure = useRef(false);
  const l = s.lesson,
    t = s.phase === 4 ? l.transfer : l.task,
    dialogue = s.phase === 4 ? s.transfer : s.dialogue;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (previousPhase.current === s.phase) return;
    previousPhase.current = s.phase;
    persistVoice(null);
    setText("");
    setBlob(null);
    setRecordingId("");
    setJob(null);
    setHelp("");
    setHelpOpen(false);
    setTyped(false);
    setHistory([]);
    setWrong("");
  }, [s.phase]);
  async function submit(
    overrides: {
      text?: string;
      answer?: string;
      input?: string;
      skip?: boolean;
    } = {},
  ) {
    setBusy(true);
    setError("");
    const body =
      failure.current && pending.current
        ? pending.current
        : {
            sessionId: s.id,
            key: crypto.randomUUID(),
            text: overrides.text ?? text,
            answer: overrides.answer,
            input:
              overrides.input ||
              (job?.trusted
                ? "voice"
                : recordingId
                  ? "voice_confirmed"
                  : "text"),
            recordingId: recordingId || undefined,
            jobId: job?.id,
            skip: overrides.skip,
          };
    pending.current = body;
    try {
      const result = await post<{ session: Session; correct: boolean }>(
        "/attempts",
        body,
      );
      failure.current = false;
      pending.current = null;
      if (!mounted.current) return;
      persistVoice(null);
      if (s.phase >= 3 && s.phase === result.session.phase) {
        setHistory((h) =>
          [...h, { who: "you", text: body.text || "" }].slice(-6),
        );
        setText("");
        setBlob(null);
        setRecordingId("");
        setJob(null);
        speak(
          result.session.phase === 4
            ? result.session.transfer.reply
            : result.session.dialogue.reply,
          data.learner.settings.rate,
          () => setError("Audio is unavailable. You can use the captions."),
        );
      }
      if (s.phase === 1 && !result.correct)
        setWrong("Not quite. Listen once more and try again.");
      setS(result.session);
      if (result.session.completed) onUpdate();
    } catch (e) {
      failure.current = true;
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function ask(kind: string) {
    setBusy(true);
    try {
      const r = await post<{ session: Session; text: string }>(
        `/sessions/${s.id}/help`,
        { kind },
      );
      setS(r.session);
      setHelp(r.text);
      if (kind === "replay" || kind === "slower")
        speak(
          s.phase === 1
            ? l.concept.prompt
            : s.phase === 2
              ? l.expressions[0]
              : dialogue.reply,
          kind === "slower" ? 0.65 : data.learner.settings.rate,
          () => setError("Audio is unavailable. Captions are still available."),
        );
      if (kind === "subtitles") setShowText((v) => !v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadAndRecognize() {
    if (!blob && !recordingId) return;
    setBusy(true);
    setError("");
    try {
      let audioId = recordingId;
      if (!audioId && blob) {
        setProcessing("Saving your recording…");
        const form = new FormData();
        form.append("audio", blob, "answer.wav");
        form.append("sessionId", s.id);
        const r = await api<{ id: string }>("/audio-uploads", {
          method: "POST",
          body: form,
        });
        audioId = r.id;
      }
      if (!mounted.current) return;
      setRecordingId(audioId);
      if (data.asrAvailable && s.phase !== 2) {
        setProcessing("Listening to your answer…");
        const request =
          voiceRequest.current?.recordingId === audioId
            ? voiceRequest.current
            : {
                recordingId: audioId,
                key: crypto.randomUUID(),
                phase: s.phase,
              };
        persistVoice(request);
        if (!request.id) {
          const created = await post<{ id: string }>("/jobs", {
            recordingId: audioId,
            key: request.key,
          });
          request.id = created.id;
          persistVoice(request);
        }
        const started = Date.now();
        while (mounted.current && Date.now() - started < 14000) {
          const status = await api<{
            id: string;
            status: string;
            text: string;
            trusted: boolean;
            error?: string;
          }>(`/jobs/${request.id}`);
          if (status.status === "done") {
            setJob(status);
            setText(status.text);
            setTyped(true);
            return;
          }
          if (status.status === "failed") {
            persistVoice(null);
            throw new Error(status.error || "识别暂时不可用，请重试。");
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (mounted.current)
          throw new Error(
            "语音处理超时。录音已保存，请稍后重试或输入文字继续。",
          );
      } else if (s.phase !== 2) {
        setTyped(true);
        setError(
          "录音已保存。语音识别尚未配置，请填写你刚才说的内容以继续演练；本次口语能力将标为尚未验证。",
        );
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        persistVoice(null);
        setRecordingId("");
      }
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProcessing("");
      }
    }
  }
  function newBlob(b: Blob | null) {
    persistVoice(null);
    setBlob(b);
    setRecordingId("");
    setJob(null);
    setError("");
  }
  function answerChoice(value: string) {
    failure.current = false;
    submit({ answer: value, input: "choice" });
  }
  function exit() {
    window.speechSynthesis?.cancel();
    onExit();
  }
  if (s.completed && s.result)
    return (
      <div className="lesson-page result-page">
        <button className="back-button" onClick={exit}>
          <ArrowLeft size={18} /> Back to today
        </button>
        <div className="result-card">
          <div className="result-icon">
            <Check size={42} />
          </div>
          <div className="eyebrow">ONE MORE THING YOU CAN DO</div>
          <h1>
            A little more English.
            <br />
            <i>A little more you.</i>
          </h1>
          <p>{s.result.feedback}</p>
          <div className="evidence-grid">
            {[
              ["Listen", s.result.comprehension],
              ["Imitate", s.result.imitation],
              ["Express", s.result.expression],
              ["Adapt", s.result.transfer],
            ].map(([label, ok]) => (
              <div key={String(label)} className={ok ? "done" : ""}>
                <CheckCircle2 size={21} />
                <span>{label}</span>
                <small>{ok ? "Practised" : "Not checked"}</small>
              </div>
            ))}
          </div>
          <div className="result-note">
            <Lightbulb size={22} />
            <div>
              <strong>
                {s.result.spoken && s.result.independent
                  ? "Independent speaking task completed"
                  : "口语能力尚未验证"}
              </strong>
              <p>{s.result.next}</p>
              <small>
                理解、模仿与自主表达分开记录。文字或手动转写不会计为独立口语成功。
              </small>
            </div>
          </div>
          <div className="review-schedule">
            <span>Next practice</span>
            <strong>
              {s.result.reviewDue
                ? new Date(s.result.reviewDue).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "Asia/Shanghai",
                  })
                : "Tomorrow"}{" "}
              · a fresh example
            </strong>
          </div>
          <button className="button primary" onClick={exit}>
            Keep the feeling. See you tomorrow.
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  return (
    <div className="lesson-page">
      <header className="lesson-top">
        <button className="back-button" onClick={exit}>
          <ArrowLeft size={18} />
          <span>Save & leave</span>
        </button>
        <div>
          <strong>{l.subtitle}</strong>
          <span>{s.phase + 1} / 5</span>
        </div>
        <button
          className="icon-button"
          title="Report a problem"
          onClick={() => setFeedbackOpen(true)}
        >
          <Flag size={18} />
        </button>
      </header>
      <div className="step-track">
        {phases.map((p, i) => (
          <div key={p} className={i <= s.phase ? "active" : ""}>
            <span>{i < s.phase ? <Check size={12} /> : i + 1}</span>
            <small>{p}</small>
          </div>
        ))}
      </div>
      <div className="learning-layout">
        <section className="learning-main">
          <div className="learning-heading">
            <div className="eyebrow">
              {s.phase === 4
                ? "NEW SCENE. SAME YOU."
                : `STEP ${s.phase + 1} · ${phases[s.phase].toUpperCase()}`}
            </div>
            <h1>
              {s.phase === 0
                ? "Step into the moment."
                : s.phase === 1
                  ? "Listen. Find the meaning."
                  : s.phase === 2
                    ? "Make it your own."
                    : s.phase === 3
                      ? "It’s your turn."
                      : "Let’s try a little twist."}
            </h1>
            <p>
              {s.phase === 0
                ? "Look around. Listen first. There’s no rush."
                : s.phase === 1
                  ? "Tap an object, or drag it into the listening area."
                  : s.phase === 2
                    ? "Listen, record, and hear yourself. You can always try again."
                    : s.phase === 3
                      ? "Use your goal card. There’s more than one right way to say it."
                      : "A new goal. A different conversation. See what you can do."}
            </p>
          </div>
          <div className="mobile-mission">
            <div>
              {t.icons.map((icon, i) => (
                <span key={i}>{icon}</span>
              ))}
            </div>
            <p>{t.goal}</p>
          </div>
          <div className={`scene-stage ${l.scene}`}>
            <SceneArt
              scene={l.scene}
              variant={
                l.scene === "foundation"
                  ? l.order * 2 + (s.phase === 4 ? 1 : 0)
                  : s.phase === 4
                    ? 1
                    : 0
              }
            />
            <span className="stage-badge">
              <span className="status-dot" />{" "}
              {s.phase === 4 ? "A different moment" : "A real-life moment"}
            </span>
            {s.phase >= 3 && (
              <div className="character-bubble">
                <span>
                  {l.scene === "friends"
                    ? "Jamie"
                    : l.scene === "directions"
                      ? "Local friend"
                      : l.scene === "shop"
                        ? "Shopkeeper"
                        : "Barista"}
                </span>
                <p>
                  {showText ? dialogue.reply : "Listen to your scene partner."}
                </p>
                <button
                  aria-label="Replay partner"
                  onClick={() => ask("replay")}
                  disabled={busy}
                >
                  <Volume2 size={19} />
                </button>
              </div>
            )}
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              {failure.current && (
                <button onClick={() => submit()} disabled={busy}>
                  Retry submission
                </button>
              )}
            </div>
          )}
          {s.phase === 0 && (
            <div className="intro-panel">
              <div className="expression-row">
                {l.expressions.map((e) => (
                  <button
                    key={e}
                    onClick={() =>
                      speak(e, data.learner.settings.rate, () =>
                        setError(
                          "Audio is unavailable on this device. Please use the text.",
                        ),
                      )
                    }
                  >
                    <Volume2 size={17} />
                    {e}
                  </button>
                ))}
              </div>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => submit({ input: "choice" })}
              >
                I’m ready. Let’s begin.
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          {s.phase === 1 && (
            <div className="choose-panel">
              <button
                className="listen-drop"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const value = e.dataTransfer.getData("text/plain");
                  if (l.concept.options.some((o) => o.value === value))
                    answerChoice(value);
                }}
                onClick={() => ask("replay")}
                disabled={busy}
              >
                <Volume2 size={24} />
                <span>{showText ? l.concept.prompt : "Tap to listen"}</span>
                <small>Listen again ↻</small>
              </button>
              <div className="choices">
                {l.concept.options.map((o) => (
                  <button
                    draggable
                    key={o.value}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", o.value)
                    }
                    onClick={() => answerChoice(o.value)}
                    disabled={busy}
                  >
                    <span
                      className={`choice-emoji ${o.value === "large" ? "large" : o.value === "small" ? "small" : ""}`}
                    >
                      {o.icon}
                    </span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
              {wrong && (
                <p className="wrong-message" role="status">
                  {wrong}
                </p>
              )}
            </div>
          )}
          {s.phase === 2 && (
            <div className="imitate-panel">
              <div className="sample">
                <button
                  className="icon-button"
                  title="Play example"
                  onClick={() => ask("replay")}
                >
                  <Volume2 size={22} />
                </button>
                <p>{l.expressions[0]}</p>
                <button className="text-button" onClick={() => ask("slower")}>
                  Slower
                </button>
              </div>
              <Recorder onReady={newBlob} onError={setError} />
              {blob && !recordingId && (
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={uploadAndRecognize}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Check size={18} />
                  )}
                  Use this recording
                </button>
              )}
              {recordingId && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => submit({ input: "voice_confirmed" })}
                >
                  Continue to the conversation
                  <ArrowRight size={18} />
                </button>
              )}
              <button
                className="text-button subtle"
                disabled={busy}
                onClick={() => submit({ skip: true, input: "choice" })}
              >
                Practise speaking later
              </button>
            </div>
          )}
          {(s.phase === 3 || s.phase === 4) && (
            <div className="conversation-panel">
              {history.length > 0 && (
                <div className="last-answer">
                  <span>You</span>
                  <p>{history.at(-1)?.text}</p>
                </div>
              )}
              <div className="audio-tools">
                <button onClick={() => ask("replay")} disabled={busy}>
                  <Volume2 size={17} />
                  Replay
                </button>
                <button onClick={() => ask("slower")} disabled={busy}>
                  <RotateCcw size={16} />
                  Slower
                </button>
                <button onClick={() => ask("subtitles")} disabled={busy}>
                  {showText ? <EyeOff size={16} /> : <Eye size={16} />}Captions
                </button>
              </div>
              <Recorder
                key={`${s.phase}-${history.length}`}
                onReady={newBlob}
                onError={setError}
              />
              {blob && !recordingId && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={uploadAndRecognize}
                >
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  Use this recording
                </button>
              )}
              {recordingId && data.asrAvailable && !job && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={uploadAndRecognize}
                >
                  <RotateCcw size={17} />
                  Resume speech processing
                </button>
              )}
              {processing && (
                <p className="processing" role="status">
                  {processing}
                </p>
              )}
              <button
                className="text-button keyboard-toggle"
                onClick={() => setTyped((v) => !v)}
              >
                <Keyboard size={16} />
                {typed ? "Hide keyboard" : "Use the keyboard"}
                <ChevronDown size={14} />
              </button>
              {typed && (
                <form
                  className="answer-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    failure.current = false;
                    submit();
                  }}
                >
                  <label htmlFor="answer">
                    {recordingId ? "Check what you said" : "Your answer"}
                    {recordingId && !job?.trusted && (
                      <small>
                        Self-reported transcript · speaking unverified
                      </small>
                    )}
                  </label>
                  <div>
                    <input
                      id="answer"
                      value={text}
                      placeholder="Your words go here…"
                      maxLength={1000}
                      autoComplete="off"
                      onChange={(e) => {
                        setText(e.target.value);
                        failure.current = false;
                        if (job) setJob({ ...job, trusted: false });
                      }}
                      disabled={busy}
                    />
                    <button
                      className="button primary"
                      disabled={busy || !text.trim()}
                      aria-label="Send answer"
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <ArrowRight size={21} />
                      )}
                    </button>
                  </div>
                  <small>
                    {job?.trusted
                      ? "Speech recognized. Confirm the transcript to send it."
                      : "Text practice keeps the conversation moving. Speaking is checked separately."}
                  </small>
                </form>
              )}
            </div>
          )}
        </section>
        <aside className="lesson-aside">
          <div className="goal-card">
            <div className="eyebrow">YOUR LITTLE MISSION</div>
            <div className="goal-icons">
              {t.icons.map((icon, i) => (
                <span key={i}>{icon}</span>
              ))}
            </div>
            <h3>{t.goal}</h3>
            <p>
              Take a breath.
              <br />
              You already have a place to start.
            </p>
            <div className="goal-rule" />
            <span className="small-label">
              {s.phase === 4 ? "FRESH EXAMPLE" : "PRACTICE MODE"}
            </span>
            <small>
              {s.phase === 4
                ? "Your own words. A new situation."
                : "Listen, explore, then give it a go."}
            </small>
          </div>
          <div className="help-card">
            <Lightbulb size={21} />
            <h3>A little help?</h3>
            <p>Try a smaller step. That’s still a step.</p>
            <button
              className="button secondary"
              onClick={() => setHelpOpen((v) => !v)}
            >
              Find a hint
              <ChevronDown size={15} />
            </button>
            {helpOpen && (
              <div className="hint-options">
                {[
                  ["visual", "Look at the goal"],
                  ["example", "A familiar example"],
                  ["starter", "Start my sentence"],
                  ["model", "Hear a full example"],
                  ...(data.learner.settings.immersion === "assisted"
                    ? [["translation", "简短中文释义"]]
                    : []),
                ].map(([kind, label]) => (
                  <button key={kind} disabled={busy} onClick={() => ask(kind)}>
                    {label}
                    <ArrowRight size={13} />
                  </button>
                ))}
                <small>
                  Sentence starters and full examples mean this try won’t count
                  as independent.
                </small>
              </div>
            )}
            {help && (
              <div className="hint-result" role="status">
                {help}
              </div>
            )}
          </div>
          <div className="privacy-note">
            <Mic size={15} />
            <span>
              Your recordings are private.
              <br />
              Deleted automatically within 24 hours.
            </span>
          </div>
        </aside>
      </div>
      {feedbackOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setFeedbackOpen(false)}
            >
              <X size={20} />
            </button>
            <MessageCircle size={28} />
            <h2 id="report-title">告诉我们卡在哪里</h2>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="声音、图片、任务或其他问题…"
            />
            <button
              className="button primary"
              disabled={report.trim().length < 2 || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await post("/feedback", { text: report, sessionId: s.id });
                  setFeedbackOpen(false);
                  setReport("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              提交反馈
              <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
