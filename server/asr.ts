export async function transcribe(
  bytes: Uint8Array,
  mime: string,
): Promise<{ text: string; trusted: boolean }> {
  if (!process.env.ASR_URL || !process.env.ASR_API_KEY)
    throw new Error("语音识别服务尚未配置，请使用文字演练。");
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mime }),
    `answer.${mime.includes("wav") ? "wav" : mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`,
  );
  form.append("model", process.env.ASR_MODEL || "whisper-1");
  form.append("language", "en");
  form.append(
    "response_format",
    process.env.ASR_RESPONSE_FORMAT || "verbose_json",
  );
  const res = await fetch(process.env.ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ASR_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("语音服务暂时不可用，请重试或使用文字演练。");
  const data = (await res.json()) as {
    text?: string;
    segments?: { no_speech_prob?: number; avg_logprob?: number }[];
  };
  if (!data.text?.trim()) throw new Error("没有识别到清晰的声音，请重录。");
  // Conservative default: providers without quality metadata require confirmation.
  const trusted =
    !!data.segments?.length &&
    data.segments.every(
      (s) => (s.no_speech_prob ?? 1) < 0.4 && (s.avg_logprob ?? -99) > -1,
    );
  return { text: data.text.trim(), trusted };
}
