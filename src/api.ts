export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/v1${path}`, {
      ...options,
      headers:
        options.body instanceof FormData
          ? options.headers
          : { "Content-Type": "application/json", ...options.headers },
      signal: options.signal || AbortSignal.timeout(18000),
    });
  } catch {
    throw new ApiError(
      navigator.onLine
        ? "连接暂时中断，请重试。已保存的进度不会丢失。"
        : "网络已断开。恢复连接后可以继续，录音仍可在本页回放。",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || "请求失败，请重试。", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export function speak(text: string, rate = 1, onError?: () => void) {
  if (!("speechSynthesis" in window)) {
    onError?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const voice =
    window.speechSynthesis.getVoices().find((v) => v.lang === "en-US") ||
    window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  u.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled") onError?.();
  };
  window.speechSynthesis.speak(u);
}
