import { createServer, Server } from "node:http";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session, AppData } from "../shared/types";
let child: ChildProcess, provider: Server;
let providerText = "A cup, please.";
const dir = mkdtempSync(join(tmpdir(), "scene-test-"));
const base = "http://127.0.0.1:3198/v1";
class Client {
  cookie = "";
  async req(path: string, method = "GET", body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    const c = r.headers.get("set-cookie");
    if (c) this.cookie = c.split(";")[0];
    return {
      status: r.status,
      data: r.status === 204 ? undefined : await r.json(),
    };
  }
  async data() {
    return (await this.req("/today")).data as AppData;
  }
  async begin(lessonId = "cafe-3") {
    return (await this.req("/sessions", "POST", { lessonId })).data as Session;
  }
  async answer(
    s: Session,
    fields: Record<string, unknown>,
    key = crypto.randomUUID(),
  ) {
    return this.req("/attempts", "POST", {
      sessionId: s.id,
      key,
      input: "text",
      ...fields,
    });
  }
}
before(async () => {
  provider = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          text: providerText,
          segments: [{ no_speech_prob: 0.01, avg_logprob: -0.1 }],
        }),
      );
    });
  });
  await new Promise<void>((resolve) =>
    provider.listen(3199, "127.0.0.1", resolve),
  );
  child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3198",
      DATA_DIR: dir,
      ADMIN_PASSWORD: "test-admin-only",
      ASR_URL: "http://127.0.0.1:3199/transcribe",
      ASR_API_KEY: "test-provider-key",
    },
    stdio: "pipe",
  });
  let logs = "";
  child.stderr?.on("data", (d) => (logs += d.toString()));
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + "/health");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Test server did not start: " + logs);
});
after(() => {
  child?.kill();
  provider?.close();
  rmSync(dir, { recursive: true, force: true });
});
test("guest identity persists; sessions and recordings cannot cross users", async () => {
  const a = new Client(),
    b = new Client();
  assert.equal((await a.data()).learner.id, (await a.data()).learner.id);
  const s = await a.begin();
  await b.data();
  assert.equal((await b.req("/sessions/" + s.id)).status, 404);
  assert.equal((await b.req("/recordings/not-owned")).status, 404);
  assert.equal((await b.req("/admin/content")).status, 403);
});
test("whole lesson, restart resume, hints, duplicate submits, and conservative evidence", async () => {
  const a = new Client();
  let s = await a.begin();
  const same = await a.begin();
  assert.equal(same.id, s.id);
  s = (await a.answer(s, {})).data.session;
  assert.equal(s.phase, 1);
  s = (await a.answer(s, { answer: s.lesson.concept.answer, input: "choice" }))
    .data.session;
  s = (await a.answer(s, { skip: true, input: "choice" })).data.session;
  assert.equal(s.phase, 3);
  let r = await a.answer(s, { text: s.lesson.task.model });
  s = r.data.session;
  assert.equal(s.dialogue.complete, false);
  s = (await a.answer(s, { text: "Yes." })).data.session;
  assert.equal(s.phase, 4);
  assert.equal(
    (await a.req(`/sessions/${s.id}/help`, "POST", { kind: "translation" }))
      .status,
    403,
  );
  await a.req(`/sessions/${s.id}/help`, "POST", { kind: "model" });
  s = (await a.req("/sessions/" + s.id)).data;
  s = (await a.answer(s, { text: s.lesson.transfer.model, input: "voice" }))
    .data.session;
  const key = crypto.randomUUID();
  const final = await a.answer(s, { text: "Yes." }, key);
  assert.equal(final.status, 200);
  assert.equal(final.data.session.completed, true);
  assert.equal(final.data.session.result.spoken, false);
  assert.equal(final.data.session.result.independent, false);
  const before = await a.data();
  const duplicate = await a.answer(s, { text: "Yes." }, key);
  const after = await a.data();
  assert.deepEqual(final.data, duplicate.data);
  assert.equal(before.evidence.length, after.evidence.length);
  assert.equal(after.reviews.length, 1);
  assert.equal(after.evidence.filter((e) => e.spoken).length, 0);
  const review = after.reviews[0];
  const rs = await a.req("/sessions", "POST", {
    lessonId: s.lessonId,
    reviewId: review.id,
  });
  assert.equal(rs.data.phase, 4);
  assert.notEqual(rs.data.lesson.transfer.id, s.lesson.transfer.id);
  assert.equal(rs.data.reviewId, review.id);
});
test("account register preserves guest and login merges another guest", async () => {
  const a = new Client();
  const original = (await a.data()).learner.id;
  await a.begin("shop-1");
  const email = "learner-" + crypto.randomUUID() + "@example.com";
  assert.equal(
    (
      await a.req("/auth", "POST", {
        mode: "register",
        email,
        password: "secure-test-password",
      })
    ).status,
    200,
  );
  assert.equal((await a.data()).learner.id, original);
  const b = new Client();
  await b.begin("friends-1");
  assert.equal(
    (
      await b.req("/auth", "POST", {
        mode: "login",
        email,
        password: "wrong-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await b.req("/auth", "POST", {
        mode: "login",
        email,
        password: "secure-test-password",
      })
    ).status,
    200,
  );
  const merged = await b.data();
  assert.equal(merged.learner.id, original);
  assert.equal(merged.sessions.length, 2);
  assert.equal((await a.data()).sessions.length, 2);
});
test("server rejects invented recording references and invalid audio payload", async () => {
  const a = new Client();
  const s = await a.begin();
  const r = await a.answer(s, {
    text: "coffee",
    input: "voice",
    recordingId: "fake",
  });
  assert.equal(r.status, 400);
  const form = new FormData();
  form.append("sessionId", s.id);
  form.append(
    "audio",
    new Blob([new Uint8Array(1024)], { type: "audio/webm" }),
    "fake.webm",
  );
  assert.equal((await a.req("/audio-uploads", "POST", form)).status, 400);
});
test("real recording is validated, can be deleted, and becomes unreadable", async () => {
  const a = new Client();
  const s = await a.begin();
  const samples = 16000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  const form = new FormData();
  form.append("sessionId", s.id);
  form.append("audio", new Blob([buffer], { type: "audio/wav" }), "answer.wav");
  const r = await a.req("/audio-uploads", "POST", form);
  assert.equal(r.status, 201);
  const list = await a.req("/recordings");
  assert.equal(list.data.length, 1);
  assert.equal((await a.req("/recordings/" + r.data.id, "DELETE")).status, 204);
  assert.equal((await a.req("/recordings")).data.length, 0);
  assert.equal((await a.req("/recordings/" + r.data.id)).status, 404);
});
test("CMS requires review, publishes immutable versions, and can roll back", async () => {
  const a = new Client();
  const d = await a.data();
  assert.equal(
    (await a.req("/admin/login", "POST", { password: "test-admin-only" }))
      .status,
    200,
  );
  const l = structuredClone(d.lessons[4]);
  const old = await a.begin(l.id);
  l.title = "Test revised title";
  const draft = await a.req("/admin/content", "POST", l);
  assert.equal(draft.status, 201);
  const version = draft.data.version;
  assert.equal(
    (await a.req(`/admin/content/${l.id}/${version}/publish`, "POST", {}))
      .status,
    400,
  );
  assert.equal(
    (
      await a.req(`/admin/content/${l.id}/${version}/review`, "POST", {
        checks: Array(8).fill(true),
      })
    ).status,
    200,
  );
  assert.equal(
    (await a.req(`/admin/content/${l.id}/${version}/publish`, "POST", {}))
      .status,
    200,
  );
  assert.equal(
    (await a.data()).lessons.find((x) => x.id === l.id)?.title,
    l.title,
  );
  assert.equal(
    (await a.req("/sessions/" + old.id)).data.lesson.title,
    old.lesson.title,
  );
  await a.req(`/admin/content/${l.id}/1/review`, "POST", {
    checks: Array(8).fill(true),
  });
  await a.req(`/admin/content/${l.id}/1/publish`, "POST", {});
  assert.equal((await a.data()).lessons.find((x) => x.id === l.id)?.version, 1);
});
test("delete learning data removes sessions, audio and evidence, preserves account", async () => {
  const a = new Client();
  const id = (await a.data()).learner.id;
  await a.begin();
  assert.equal((await a.req("/data", "DELETE")).status, 204);
  const d = await a.data();
  assert.equal(d.learner.id, id);
  assert.equal(d.sessions.length, 0);
  assert.equal(d.reviews.length, 0);
  assert.equal(d.evidence.length, 0);
  assert.equal(d.learner.settings.onboarded, false);
});

test("verified provider output can supply oral slots; edited transcripts cannot impersonate it", async () => {
  const a = new Client();
  let s = await a.begin("foundation-1");
  s = (await a.answer(s, {})).data.session;
  s = (await a.answer(s, { answer: "water", input: "choice" })).data.session;
  s = (await a.answer(s, { skip: true, input: "choice" })).data.session;
  s = (await a.answer(s, { text: "Water, please." })).data.session;
  s = (await a.answer(s, { text: "Yes." })).data.session;
  assert.equal(s.phase, 4);
  const buffer = Buffer.alloc(32044);
  buffer.write("RIFF");
  buffer.writeUInt32LE(32036, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16000, 24);
  buffer.writeUInt32LE(32000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(32000, 40);
  const f = new FormData();
  f.append("sessionId", s.id);
  f.append("audio", new Blob([buffer], { type: "audio/wav" }), "answer.wav");
  const recording = (await a.req("/audio-uploads", "POST", f)).data;
  providerText = "A cup, please.";
  const key = crypto.randomUUID();
  const j = (await a.req("/jobs", "POST", { recordingId: recording.id, key }))
    .data;
  assert.equal(
    (await a.req("/jobs", "POST", { recordingId: recording.id, key })).data.id,
    j.id,
  );
  let job;
  for (let i = 0; i < 30; i++) {
    job = (await a.req("/jobs/" + j.id)).data;
    if (job.status === "done") break;
    await new Promise((r) => setTimeout(r, 30));
  }
  assert.equal(job.trusted, true);
  const edited = (
    await a.answer(s, {
      text: "Cup.",
      input: "voice",
      recordingId: recording.id,
      jobId: j.id,
    })
  ).data.session;
  assert.equal(edited.transfer.slots.object.input, "voice_confirmed");
  s = (
    await a.answer(s, {
      text: job.text,
      input: "voice",
      recordingId: recording.id,
      jobId: j.id,
    })
  ).data.session;
  assert.equal(s.transfer.slots.object.input, "voice");
  s = (await a.answer(s, { text: "Yes." })).data.session;
  assert.equal(s.result?.spoken, true);
  assert.equal(s.result?.independent, true);
});

test("local web origin can submit while unrelated sites are rejected", async () => {
  const a = new Client();
  await a.data();
  const request = (origin: string) =>
    fetch(base + "/feedback", {
      method: "POST",
      headers: { origin, cookie: a.cookie, "content-type": "application/json" },
      body: JSON.stringify({ text: "Origin check" }),
    });
  assert.equal((await request("http://localhost:5174")).status, 201);
  assert.equal((await request("https://unrelated.example")).status, 403);
});

test("replaying a unit does not duplicate reviews or extend intervals on the same day", async () => {
  const a = new Client();
  for (let i = 0; i < 2; i++) {
    let s = await a.begin("foundation-1");
    s = (await a.answer(s, {})).data.session;
    s = (await a.answer(s, { answer: "water", input: "choice" })).data.session;
    s = (await a.answer(s, { skip: true, input: "choice" })).data.session;
    s = (await a.answer(s, { text: s.lesson.task.model })).data.session;
    s = (await a.answer(s, { text: "Yes." })).data.session;
    s = (await a.answer(s, { text: s.lesson.transfer.model })).data.session;
    s = (await a.answer(s, { text: "Yes." })).data.session;
    assert.ok(s.completed);
  }
  const d = await a.data();
  assert.equal(d.reviews.length, 1);
  assert.equal(d.reviews[0].interval, 1);
  assert.equal(d.reviews[0].repetitions, 2);
  assert.deepEqual(
    d.evidence.filter((e) => e.kind === "transfer").map((e) => e.novel),
    [true, false],
  );
});
