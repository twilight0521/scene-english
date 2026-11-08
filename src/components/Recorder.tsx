import { useEffect, useRef, useState } from "react";
import { recordingToWav } from "../audio";
import { Mic, Square, RotateCcw, Trash2, Volume2 } from "lucide-react";
export function Recorder({
  onReady,
  onError,
}: {
  onReady: (blob: Blob | null) => void;
  onError: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false),
    [url, setUrl] = useState(""),
    [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    active = useRef(true),
    urlRef = useRef("");
  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
  }
  useEffect(() => {
    active.current = true;
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      active.current = false;
      if (rec.current?.state === "recording") rec.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  async function start() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      onError("当前浏览器不支持录音。请使用较新的浏览器，或继续文字演练。");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      rec.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        if (!active.current) return;
        let b = new Blob(chunks, { type: r.mimeType });
        if (b.size < 200) {
          onError("录音太短，请再试一次。");
          return;
        }
        try {
          b = await recordingToWav(b);
        } catch {
          onError("录音处理失败，请重新录制或使用文字演练。");
          return;
        }
        if (!active.current) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(b);
        setUrl(urlRef.current);
        onReady(b);
      };
      r.start();
      setSeconds(0);
      setRecording(true);
      onReady(null);
      timer.current = setInterval(
        () =>
          setSeconds((v) => {
            if (v >= 29) {
              stop();
              return 30;
            }
            return v + 1;
          }),
        1000,
      );
    } catch (e) {
      onError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "麦克风权限未开启。你仍可以完成理解练习和文字演练；口语能力会标为尚未验证。"
          : "无法使用麦克风，请检查设备后重试，或继续文字演练。",
      );
    }
  }
  return (
    <div className="recorder">
      <button
        className={`record-button ${recording ? "recording" : ""}`}
        onClick={recording ? stop : start}
        aria-label={recording ? "Stop recording" : "Record your answer"}
      >
        {recording ? (
          <Square size={23} fill="currentColor" />
        ) : (
          <Mic size={26} />
        )}
        <span>
          {recording
            ? `Recording · ${seconds}s`
            : url
              ? "Record again"
              : "Record your answer"}
        </span>
      </button>
      <div className="record-note">
        {recording
          ? "Tap to stop · up to 30 seconds"
          : "Your voice. Your pace. No perfect accent needed."}
      </div>
      {url && !recording && (
        <div className="playback">
          <Volume2 size={18} />
          <audio aria-label="Your recording" src={url} controls />
          <button
            className="icon-button"
            title="Delete recording"
            onClick={() => {
              URL.revokeObjectURL(urlRef.current);
              urlRef.current = "";
              setUrl("");
              onReady(null);
            }}
          >
            <Trash2 size={18} />
          </button>
          <button className="icon-button" title="Record again" onClick={start}>
            <RotateCcw size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
