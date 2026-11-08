// MediaRecorder WebM often has no duration header. Normalize to PCM WAV so the
// server can independently validate duration without system audio utilities.
export async function recordingToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext({ sampleRate: 24000 });
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = buffer.length;
    const bytes = new ArrayBuffer(44 + frames * 2);
    const view = new DataView(bytes);
    const write = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        view.setUint8(offset + i, value.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + frames * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, frames * 2, true);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    for (let i = 0; i < frames; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i];
      value = Math.max(-1, Math.min(1, value / channels.length));
      view.setInt16(
        44 + i * 2,
        value < 0 ? value * 32768 : value * 32767,
        true,
      );
    }
    return new Blob([bytes], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
