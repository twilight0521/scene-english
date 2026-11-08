import "node:process";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
// Read local configuration before importing database and provider modules.
if (existsSync(".env"))
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
const { db, getJSON, listJSON, saveJSON, transaction } = await import("./db");
const { transcribe } = await import("./asr");
import { LESSONS, reviewLesson } from "../shared/content";
import { parseBuffer } from "music-metadata";
import {
  initialDialogue,
  advance,
  buildResult,
  scheduleReview,
  RULE_VERSION,
} from "../shared/engine";
import type {
  AppData,
  Learner,
  Lesson,
  Session,
  Evidence,
  Review,
  InputMode,
} from "../shared/types";
const app = express();
const port = Number(process.env.PORT || 3001);
const uid = () => randomUUID();
const now = () => new Date().toISOString();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", "loopback");
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    if (
      origin &&
      origin !== `${req.protocol}://${req.headers.host}` &&
      !(
        /^http:\/\/(localhost|127\.0\.0\.1):517[34]$/.test(origin) &&
        process.env.NODE_ENV !== "production"
      )
    )
      return res.status(403).json({ error: "请求来源不允许。" });
  }
  next();
});
const defaultSettings: Learner["settings"] = {
  immersion: "strict",
  subtitles: true,
  rate: 1,
  onboarded: false,
  goal: "daily",
  level: "beginner",
};
function newLearner() {
  const l: Learner = {
    id: uid(),
    name: "学习者",
    email: null,
    settings: { ...defaultSettings },
  };
  db.prepare(
    "INSERT INTO learners(id,name,email,settings) VALUES(?,?,?,?)",
  ).run(l.id, l.name, null, JSON.stringify(l.settings));
  return l;
}
function issueToken(res: express.Response, id: string) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO tokens(token,user_id,expires) VALUES(?,?,?)").run(
    token,
    id,
    Date.now() + 30 * 86400000,
  );
  res.cookie("scene_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 30 * 86400000,
    path: "/",
  });
  return token;
}
function learner(id: string): Learner {
  const row = db
    .prepare("SELECT id,name,email,settings FROM learners WHERE id=?")
    .get(id) as unknown as Omit<Learner, "settings"> & { settings: string };
  return { ...row, settings: JSON.parse(row.settings) };
}
app.get("/v1/health", (_req, res) =>
  res.json({ ok: true, ruleVersion: RULE_VERSION }),
);
app.use("/v1", (req, res, next) => {
  const row = req.cookies.scene_token
    ? (db
        .prepare("SELECT user_id,admin FROM tokens WHERE token=? AND expires>?")
        .get(req.cookies.scene_token, Date.now()) as
        { user_id: string; admin: number } | undefined)
    : undefined;
  if (row) {
    res.locals.token = req.cookies.scene_token;
    res.locals.userId = row.user_id;
    res.locals.admin = !!row.admin;
  } else {
    const l = newLearner();
    res.locals.token = issueToken(res, l.id);
    res.locals.userId = l.id;
    res.locals.admin = false;
  }
  next();
});
function event(user: string, kind: string, data: unknown) {
  db.prepare("INSERT INTO events VALUES(?,?,?,?,?)").run(
    uid(),
    user,
    kind,
    JSON.stringify(data),
    now(),
  );
}
for (const lesson of LESSONS)
  db.prepare(
    "INSERT OR IGNORE INTO lesson_versions(id,version,data,status,published) VALUES(?,?,?,?,1)",
  ).run(lesson.id, lesson.version, JSON.stringify(lesson), "pilot");
function lessons(): Lesson[] {
  return (
    db
      .prepare("SELECT data FROM lesson_versions WHERE published=1 ORDER BY id")
      .all() as { data: string }[]
  )
    .map((r) => JSON.parse(r.data))
    .sort((a, b) => a.order - b.order);
}
function session(req: express.Request, res: express.Response) {
  const s = getJSON<Session>(
    "sessions",
    String(req.params.id || req.body.sessionId),
    res.locals.userId,
  );
  if (!s) {
    res.status(404).json({ error: "没有找到这次学习记录。" });
    return;
  }
  return s;
}
function saveSession(s: Session, user: string) {
  s.updatedAt = now();
  saveJSON("sessions", s.id, user, s);
}
function deleteRecording(id: string, user: string) {
  db.prepare("DELETE FROM recordings WHERE id=? AND user_id=?").run(id, user);
  for (const row of db
    .prepare("SELECT id,data FROM attempts WHERE user_id=?")
    .all(user) as { id: string; data: string }[]) {
    const a = JSON.parse(row.data);
    if (a.recordingId === id) {
      delete a.recordingId;
      db.prepare("UPDATE attempts SET data=? WHERE id=?").run(
        JSON.stringify(a),
        row.id,
      );
    }
  }
  for (const j of listJSON<{ id: string; recordingId?: string }>("jobs", user))
    if (j.recordingId === id)
      db.prepare("DELETE FROM jobs WHERE id=? AND user_id=?").run(j.id, user);
}
function cleanup() {
  transaction(() => {
    for (const r of db
      .prepare("SELECT id,user_id FROM recordings WHERE created<=?")
      .all(Date.now() - 23 * 3600000) as { id: string; user_id: string }[])
      deleteRecording(r.id, r.user_id);
    db.prepare("DELETE FROM tokens WHERE expires<?").run(Date.now());
  });
}
// A 23-hour threshold plus hourly sweep keeps retention within 24 hours.
cleanup();
setInterval(cleanup, 3600000).unref();
// A restarted process never leaves a job waiting indefinitely.
for (const row of db.prepare("SELECT id,user_id,data FROM jobs").all() as {
  id: string;
  user_id: string;
  data: string;
}[]) {
  const j = JSON.parse(row.data);
  if (j.status === "processing")
    saveJSON("jobs", row.id, row.user_id, {
      ...j,
      status: "failed",
      error: "服务已重启，请重新提交录音。",
    });
}

app.get("/v1/today", (_req, res) => {
  const user = res.locals.userId;
  const data: AppData = {
    learner: learner(user),
    lessons: lessons(),
    sessions: listJSON("sessions", user),
    reviews: listJSON("reviews", user),
    evidence: listJSON("evidence", user),
    asrAvailable: !!(process.env.ASR_URL && process.env.ASR_API_KEY),
    adminEnabled: !!process.env.ADMIN_PASSWORD,
  };
  res.json(data);
});
app.patch("/v1/learner", (req, res) => {
  const current = learner(res.locals.userId);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(40).optional(),
      settings: z
        .object({
          immersion: z.enum(["strict", "assisted"]).optional(),
          subtitles: z.boolean().optional(),
          rate: z.number().min(0.5).max(1.25).optional(),
          onboarded: z.boolean().optional(),
          goal: z.enum(["daily", "travel", "social"]).optional(),
          level: z.enum(["beginner", "returning"]).optional(),
        })
        .optional(),
    })
    .parse(req.body);
  const updated = {
    ...current,
    ...parsed,
    settings: { ...current.settings, ...parsed.settings },
  };
  db.prepare("UPDATE learners SET name=?,settings=? WHERE id=?").run(
    updated.name,
    JSON.stringify(updated.settings),
    current.id,
  );
  res.json(updated);
});
const authAttempts = new Map<string, { count: number; until: number }>();
app.post("/v1/auth", (req, res) => {
  const key = req.ip || "local";
  let rate = authAttempts.get(key);
  if (!rate || rate.until < Date.now()) {
    rate = { count: 0, until: Date.now() + 60000 };
    authAttempts.set(key, rate);
  }
  if (++rate.count > 10)
    return res.status(429).json({ error: "尝试次数较多，请一分钟后重试。" });
  const { mode, email, password } = z
    .object({
      mode: z.enum(["register", "login"]),
      email: z
        .email()
        .max(200)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(8).max(128),
    })
    .parse(req.body);
  const oldUser = res.locals.userId;
  let target = oldUser;
  if (mode === "register") {
    if (learner(oldUser).email)
      return res.status(400).json({ error: "你已登录账号。" });
    if (db.prepare("SELECT id FROM learners WHERE email=?").get(email))
      return res.status(409).json({ error: "该邮箱已注册，请登录。" });
    const salt = randomBytes(16).toString("hex");
    db.prepare("UPDATE learners SET email=?,password=? WHERE id=?").run(
      email,
      `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
      oldUser,
    );
  } else {
    const row = db
      .prepare("SELECT id,password FROM learners WHERE email=?")
      .get(email) as { id: string; password: string } | undefined;
    const [salt, hash] = (
      row?.password || "invalid:" + Buffer.alloc(64).toString("hex")
    ).split(":");
    if (
      !timingSafeEqual(
        scryptSync(password, salt, 64),
        Buffer.from(hash, "hex"),
      ) ||
      !row
    )
      return res.status(401).json({ error: "邮箱或密码不正确。" });
    target = row.id;
    if (target !== oldUser && !learner(oldUser).email)
      transaction(() => {
        for (const table of [
          "sessions",
          "attempts",
          "evidence",
          "reviews",
          "recordings",
          "jobs",
          "events",
        ])
          db.prepare(`UPDATE ${table} SET user_id=? WHERE user_id=?`).run(
            target,
            oldUser,
          );
        db.prepare("DELETE FROM tokens WHERE user_id=?").run(oldUser);
        db.prepare("DELETE FROM learners WHERE id=?").run(oldUser);
      });
  }
  db.prepare("DELETE FROM tokens WHERE token=?").run(
    req.cookies.scene_token || "",
  );
  issueToken(res, target);
  res.json(learner(target));
});
app.post("/v1/logout", (req, res) => {
  db.prepare("DELETE FROM tokens WHERE token=?").run(
    req.cookies.scene_token || "",
  );
  const l = newLearner();
  issueToken(res, l.id);
  res.json(l);
});
app.post("/v1/sessions", (req, res) => {
  const { lessonId, reviewId } = z
    .object({ lessonId: z.string(), reviewId: z.string().optional() })
    .parse(req.body);
  let l = lessons().find((l) => l.id === lessonId);
  if (!l) return res.status(404).json({ error: "课程未发布。" });
  if (reviewId && !getJSON<Review>("reviews", reviewId, res.locals.userId))
    return res.status(404).json({ error: "复习项不存在。" });
  if (reviewId)
    l = reviewLesson(
      l,
      getJSON<Review>("reviews", reviewId, res.locals.userId)!.repetitions,
    );
  const existing = listJSON<Session>("sessions", res.locals.userId).find(
    (s) => s.lessonId === lessonId && !s.completed && s.reviewId === reviewId,
  );
  if (existing) return res.json(existing);
  const s: Session = {
    id: uid(),
    lessonId,
    lesson: l,
    phase: reviewId ? 4 : 0,
    conditions: {
      subtitles: learner(res.locals.userId).settings.subtitles,
      rate: learner(res.locals.userId).settings.rate,
      goalText: true,
    },
    reviewId,
    dialogue: initialDialogue(l.task),
    transfer: initialDialogue(l.transfer),
    supports: [],
    completed: false,
    createdAt: now(),
    updatedAt: now(),
  };
  saveSession(s, res.locals.userId);
  event(res.locals.userId, "session_started", {
    session: s.id,
    version: l.version,
  });
  res.status(201).json(s);
});
app.get("/v1/sessions/:id", (req, res) => {
  const s = session(req, res);
  if (s) res.json(s);
});
function commitAttempt(
  s: Session,
  user: string,
  body: {
    key: string;
    text?: string;
    answer?: string;
    input: InputMode;
    recordingId?: string;
    jobId?: string;
    skip?: boolean;
  },
) {
  const existing = db
    .prepare("SELECT result FROM attempts WHERE user_id=? AND request_key=?")
    .get(user, body.key) as { result: string } | undefined;
  if (existing) return JSON.parse(existing.result);
  if (s.completed) throw new Error("这节课已完成，请开启新的挑战。");
  if (
    body.recordingId &&
    !db
      .prepare(
        "SELECT id FROM recordings WHERE id=? AND user_id=? AND session_id=?",
      )
      .get(body.recordingId, user, s.id)
  )
    throw new Error("录音不存在或不属于这次学习。");
  let correct = false;
  let input = body.input;
  if (input === "voice") {
    const job = body.jobId
      ? getJSON<{
          status: string;
          trusted: boolean;
          recordingId: string;
          text: string;
        }>("jobs", body.jobId, user)
      : undefined;
    if (
      !job ||
      job.status !== "done" ||
      !job.trusted ||
      job.recordingId !== body.recordingId ||
      job.text !== body.text
    )
      input = "voice_confirmed";
  }
  if (
    input === "voice_confirmed" &&
    (!body.recordingId ||
      !db
        .prepare(
          "SELECT id FROM recordings WHERE id=? AND user_id=? AND session_id=?",
        )
        .get(body.recordingId, user, s.id))
  )
    input = "text";
  const attempt = {
    strategy: false,
    conditions: s.conditions || {
      subtitles: learner(user).settings.subtitles,
      rate: learner(user).settings.rate,
      goalText: true,
    },
    phase: s.phase,
    correct: false,
    input,
    text: body.text || body.answer || "",
    recordingId: body.recordingId,
    ruleVersion: RULE_VERSION,
    lessonVersion: s.lesson.version,
    at: now(),
    supports: [...s.supports],
  };
  if (s.phase === 1) {
    correct = body.answer === s.lesson.concept.answer;
    if (correct) s.phase = 2;
  } else if (s.phase === 2) {
    if (!body.skip && !body.recordingId && !body.text?.trim())
      throw new Error("请先录音，或选择稍后练习口语。");
    s.phase = 3;
    correct = !body.skip;
  } else if (s.phase === 3 || s.phase === 4) {
    if (!body.text?.trim()) throw new Error("请先说出或输入你的回答。");
    const field = s.phase === 3 ? "dialogue" : "transfer";
    const t = s.phase === 3 ? s.lesson.task : s.lesson.transfer;
    s[field] = advance(t, s[field], body.text, input);
    attempt.strategy = s[field].strategy;
    if (attempt.strategy) {
      const e: Evidence = {
        id: uid(),
        lessonId: s.lessonId,
        scene: s.lesson.scene,
        kind: "strategy",
        date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Shanghai",
        }).format(new Date()),
        novel: false,
        independent: false,
        spoken: input === "voice",
        sessionId: s.id,
        taskId: t.id,
      };
      saveJSON("evidence", e.id, user, e);
    }
    correct = s[field].complete;
    if (correct) s.phase = s.phase === 3 ? 4 : 5;
  } else if (s.phase === 0) {
    s.phase = 1;
    correct = true;
  } else throw new Error("当前阶段无法提交。");
  attempt.correct = correct;
  if (s.phase === 5) {
    s.completed = true;
    const previous = (
      db
        .prepare("SELECT data FROM attempts WHERE session_id=? AND user_id=?")
        .all(s.id, user) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
    s.result = buildResult(s, [...previous, attempt]);
    for (const [kind, ok] of Object.entries({
      comprehension: s.result.comprehension,
      imitation: s.result.imitation,
      expression: s.result.expression,
      transfer: s.result.transfer,
    })) {
      if (ok) {
        const e: Evidence = {
          id: uid(),
          lessonId: s.lessonId,
          scene: s.lesson.scene,
          kind,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
          }).format(new Date()),
          novel:
            kind === "transfer" &&
            !listJSON<Session>("sessions", user).some(
              (previous) =>
                previous.completed &&
                previous.lesson.scene === s.lesson.scene &&
                [previous.lesson.task, previous.lesson.transfer].some(
                  (task) =>
                    JSON.stringify(task.target) ===
                    JSON.stringify(s.lesson.transfer.target),
                ),
            ),
          taskId: kind === "transfer" ? s.lesson.transfer.id : s.lesson.task.id,
          independent: kind === "transfer" && s.result.independent,
          spoken: kind === "transfer" && s.result.spoken,
          sessionId: s.id,
        };
        saveJSON("evidence", e.id, user, e);
      }
    }
    const previousReview = s.reviewId
      ? getJSON<Review>("reviews", s.reviewId, user)
      : listJSON<Review>("reviews", user).find(
          (r) => r.lessonId === s.lessonId,
        );
    const reviewId = previousReview?.id || `${s.lessonId}:${uid()}`;
    const lastSession = previousReview?.lastSession
      ? getJSON<Session>("sessions", previousReview.lastSession, user)
      : undefined;
    const dateKey = (at: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
        new Date(at),
      );
    const canExtend =
      !previousReview ||
      (!!lastSession &&
        dateKey(lastSession.updatedAt) !== dateKey(now()) &&
        JSON.stringify(lastSession.lesson.transfer.target) !==
          JSON.stringify(s.lesson.transfer.target));
    const sch =
      s.result.independent && previousReview && !canExtend
        ? { interval: previousReview.interval, due: previousReview.due }
        : scheduleReview(previousReview?.interval || 0, s.result.independent);
    s.result.reviewDue = sch.due;
    saveJSON("reviews", reviewId, user, {
      id: reviewId,
      lessonId: s.lessonId,
      ...sch,
      repetitions: (previousReview?.repetitions || 0) + 1,
      lastSession: s.id,
    });
    event(user, "session_completed", { session: s.id, result: s.result });
  }
  saveSession(s, user);
  const result = {
    session: s,
    correct,
    needsClarification:
      s.phase === 3
        ? s.dialogue.needsClarification
        : s.phase === 4
          ? s.transfer.needsClarification
          : false,
  };
  db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?)").run(
    uid(),
    user,
    s.id,
    body.key,
    JSON.stringify(attempt),
    JSON.stringify(result),
  );
  return result;
}
app.post("/v1/attempts", (req, res) => {
  const body = z
    .object({
      sessionId: z.string(),
      key: z.string().min(8).max(100),
      text: z.string().max(1000).optional(),
      answer: z.string().max(100).optional(),
      input: z
        .enum(["text", "voice", "voice_confirmed", "choice"])
        .default("text"),
      recordingId: z.string().optional(),
      jobId: z.string().optional(),
      skip: z.boolean().optional(),
    })
    .parse(req.body);
  const old = db
    .prepare(
      "SELECT session_id,result FROM attempts WHERE user_id=? AND request_key=?",
    )
    .get(res.locals.userId, body.key) as
    { session_id: string; result: string } | undefined;
  if (old) {
    if (old.session_id !== body.sessionId)
      return res.status(409).json({ error: "提交编号已被使用。" });
    return res.json(JSON.parse(old.result));
  }
  const s = getJSON<Session>("sessions", body.sessionId, res.locals.userId);
  if (!s) return res.status(404).json({ error: "学习记录不存在。" });
  res.json(transaction(() => commitAttempt(s, res.locals.userId, body)));
});
app.post("/v1/sessions/:id/help", (req, res) => {
  const s = session(req, res);
  if (!s) return;
  const { kind } = z
    .object({
      kind: z.enum([
        "replay",
        "slower",
        "visual",
        "example",
        "starter",
        "model",
        "translation",
        "subtitles",
      ]),
    })
    .parse(req.body);
  const level = {
    replay: 1,
    slower: 1,
    visual: 2,
    example: 3,
    starter: 4,
    model: 5,
    translation: 6,
    subtitles: 2,
  }[kind];
  if (
    kind === "translation" &&
    learner(res.locals.userId).settings.immersion === "strict"
  )
    return res.status(403).json({ error: "严格沉浸模式不提供中文释义。" });
  if (s.completed) return res.status(409).json({ error: "课程已结束。" });
  const t = s.phase === 4 ? s.lesson.transfer : s.lesson.task;
  if (kind === "subtitles") {
    s.conditions = s.conditions || {
      subtitles: learner(res.locals.userId).settings.subtitles,
      rate: learner(res.locals.userId).settings.rate,
      goalText: true,
    };
    s.conditions.subtitles = !s.conditions.subtitles;
  }
  s.supports.push({
    level,
    kind,
    at: now(),
    phase: s.phase === 4 ? "transfer" : "practice",
  });
  saveSession(s, res.locals.userId);
  res.json({
    session: s,
    level,
    text:
      kind === "translation"
        ? t.zh
        : kind === "starter"
          ? t.model.split(" ").slice(0, 2).join(" ") + " …"
          : kind === "model"
            ? t.model
            : kind === "example"
              ? s.lesson.expressions[0]
              : kind === "visual"
                ? t.goal
                : "",
  });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});
app.post("/v1/audio-uploads", upload.single("audio"), async (req, res) => {
  const s = getJSON<Session>("sessions", req.body.sessionId, res.locals.userId);
  if (!s || s.completed)
    return res.status(404).json({ error: "学习会话不存在或已结束。" });
  if (
    !req.file ||
    !/^audio\/(webm|ogg|mp4|mpeg|wav|x-wav)(;.*)?$/.test(req.file.mimetype) ||
    req.file.size < 200
  )
    return res
      .status(400)
      .json({ error: "请提交有效录音，支持 WebM、MP4、OGG 或 WAV。" });
  const metadata = await parseBuffer(
    req.file.buffer,
    { mimeType: req.file.mimetype },
    { duration: true },
  ).catch(() => undefined);
  if (
    !metadata?.format.duration ||
    !metadata.format.numberOfChannels ||
    metadata.format.duration > 31 ||
    metadata.format.duration < 0.2
  )
    return res
      .status(400)
      .json({ error: "录音长度需在 0.2 到 30 秒之间，请重新录制。" });
  const id = uid();
  db.prepare("INSERT INTO recordings VALUES(?,?,?,?,?,?)").run(
    id,
    res.locals.userId,
    s.id,
    req.file.mimetype,
    req.file.buffer,
    Date.now(),
  );
  res.status(201).json({ id, expires: Date.now() + 86400000 });
});
app.get("/v1/recordings", (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT id,mime,created FROM recordings WHERE user_id=? ORDER BY created DESC",
      )
      .all(res.locals.userId),
  ),
);
app.get("/v1/recordings/:id", (req, res) => {
  const r = db
    .prepare("SELECT data,mime FROM recordings WHERE id=? AND user_id=?")
    .get(String(req.params.id), res.locals.userId) as
    { data: Uint8Array; mime: string } | undefined;
  if (!r) return res.status(404).json({ error: "录音已删除或过期。" });
  res.type(r.mime).send(Buffer.from(r.data));
});
app.delete("/v1/recordings/:id", (req, res) => {
  transaction(() => deleteRecording(String(req.params.id), res.locals.userId));
  res.status(204).end();
});
app.post("/v1/jobs", async (req, res) => {
  const { recordingId, key } = z
    .object({ recordingId: z.string(), key: z.string().min(8).max(100) })
    .parse(req.body);
  const old = listJSON<{ id: string; key: string }>(
    "jobs",
    res.locals.userId,
  ).find((j) => j.key === key);
  if (old) return res.status(202).json(old);
  const r = db
    .prepare("SELECT data,mime FROM recordings WHERE id=? AND user_id=?")
    .get(recordingId, res.locals.userId) as
    { data: Uint8Array; mime: string } | undefined;
  if (!r) return res.status(404).json({ error: "录音不存在。" });
  const id = uid(),
    user = res.locals.userId;
  const job = { id, key, recordingId, status: "processing", createdAt: now() };
  saveJSON("jobs", id, user, job);
  res.status(202).json(job);
  try {
    const result = await transcribe(r.data, r.mime);
    if (getJSON("jobs", id, user))
      saveJSON("jobs", id, user, { ...job, status: "done", ...result });
  } catch (e) {
    if (getJSON("jobs", id, user))
      saveJSON("jobs", id, user, {
        ...job,
        status: "failed",
        error: e instanceof Error ? e.message : "语音处理失败，请重试。",
      });
  }
});
app.get("/v1/jobs/:id", (req, res) => {
  const j = getJSON("jobs", String(req.params.id), res.locals.userId);
  if (!j) return res.status(404).json({ error: "处理任务不存在。" });
  res.json(j);
});
app.post("/v1/feedback", (req, res) => {
  const data = z
    .object({
      text: z.string().trim().min(2).max(2000),
      sessionId: z.string().optional(),
    })
    .parse(req.body);
  event(res.locals.userId, "feedback", data);
  res.status(201).json({ ok: true });
});
app.get("/v1/export", (_req, res) => {
  const user = res.locals.userId;
  res.attachment("scene-english-progress.json").json({
    learner: learner(user),
    sessions: listJSON("sessions", user),
    evidence: listJSON("evidence", user),
    reviews: listJSON("reviews", user),
  });
});
app.delete("/v1/data", (_req, res) => {
  const user = res.locals.userId;
  transaction(() => {
    for (const table of [
      "sessions",
      "attempts",
      "evidence",
      "reviews",
      "recordings",
      "jobs",
      "events",
    ])
      db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(user);
    db.prepare("UPDATE learners SET settings=? WHERE id=?").run(
      JSON.stringify(defaultSettings),
      user,
    );
  });
  res.status(204).end();
});
app.post("/v1/admin/login", (req, res) => {
  const rateKey = "admin:" + req.ip;
  let limit = authAttempts.get(rateKey);
  if (!limit || limit.until < Date.now()) {
    limit = { count: 0, until: Date.now() + 60000 };
    authAttempts.set(rateKey, limit);
  }
  if (++limit.count > 10)
    return res.status(429).json({ error: "尝试次数较多，请一分钟后重试。" });
  const password = z.string().max(200).parse(req.body.password);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected)
    return res
      .status(503)
      .json({ error: "请在服务器 .env 中设置 ADMIN_PASSWORD 后启用后台。" });
  const a = Buffer.from(password),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return res.status(401).json({ error: "管理密码不正确。" });
  db.prepare("UPDATE tokens SET admin=1 WHERE token=?").run(res.locals.token);
  res.json({ ok: true });
});
app.use("/v1/admin", (req, res, next) =>
  res.locals.admin
    ? next()
    : res.status(403).json({ error: "请先登录内容后台。" }),
);
app.get("/v1/admin/content", (_req, res) =>
  res.json({
    versions: (
      db
        .prepare("SELECT * FROM lesson_versions ORDER BY id,version DESC")
        .all() as { data: string }[]
    ).map((r) => ({ ...r, data: JSON.parse(r.data) })),
    stats: {
      learners: (
        db.prepare("SELECT count(*) AS n FROM learners").get() as { n: number }
      ).n,
      sessions: (
        db.prepare("SELECT count(*) AS n FROM sessions").get() as { n: number }
      ).n,
      recordings: (
        db.prepare("SELECT count(*) AS n FROM recordings").get() as {
          n: number;
        }
      ).n,
    },
    feedback: db
      .prepare(
        "SELECT data,created FROM events WHERE kind='feedback' ORDER BY created DESC LIMIT 30",
      )
      .all(),
  }),
);
const taskSchema = z.object({
  id: z.string().min(1),
  target: z.record(z.string(), z.string()),
  slots: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        values: z.record(z.string(), z.array(z.string().min(1)).min(1)),
      }),
    )
    .min(1),
  opening: z.string().min(1),
  questions: z.record(z.string(), z.string()),
  model: z.string().min(1),
  goal: z.string().min(1),
  zh: z.string(),
  icons: z.array(z.string()),
});
const lessonSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d+$/),
  scene: z.enum(["foundation", "cafe", "shop", "directions", "friends"]),
  order: z.number(),
  title: z.string().min(1),
  subtitle: z.string(),
  minutes: z.number().positive(),
  expressions: z.array(z.string().min(1)).min(1),
  concept: z.object({
    prompt: z.string(),
    answer: z.string(),
    options: z
      .array(
        z.object({ value: z.string(), label: z.string(), icon: z.string() }),
      )
      .min(2),
  }),
  task: taskSchema,
  transfer: taskSchema,
  version: z.number().int().positive(),
  status: z.enum(["pilot", "reviewed"]),
});
app.post("/v1/admin/content", (req, res) => {
  const l = lessonSchema.parse(req.body);
  for (const t of [l.task, l.transfer])
    for (const s of t.slots)
      if (!t.target[s.key] || !s.values[t.target[s.key]] || !t.questions[s.key])
        return res
          .status(400)
          .json({ error: `任务 ${t.id} 的槽位 ${s.key} 缺少目标或追问。` });
  if (
    !l.concept.options.some((o) => o.value === l.concept.answer) ||
    l.task.id === l.transfer.id ||
    JSON.stringify(l.task.target) === JSON.stringify(l.transfer.target)
  )
    return res
      .status(400)
      .json({ error: "请检查理解题答案，并为迁移任务使用不同目标。" });
  const v =
    (
      db
        .prepare("SELECT max(version) AS v FROM lesson_versions WHERE id=?")
        .get(l.id) as { v: number }
    ).v || 0;
  l.version = v + 1;
  l.status = "pilot";
  db.prepare("INSERT INTO lesson_versions VALUES(?,?,?,?,0)").run(
    l.id,
    l.version,
    JSON.stringify(l),
    "draft",
  );
  res.status(201).json(l);
});
app.post("/v1/admin/content/:id/:version/review", (req, res) => {
  const id = String(req.params.id),
    v = Number(req.params.version);
  const row = db
    .prepare("SELECT data,status FROM lesson_versions WHERE id=? AND version=?")
    .get(id, v) as { data: string; status: string } | undefined;
  if (!row) return res.status(404).json({ error: "版本不存在。" });
  const checks = z.array(z.boolean()).length(8).parse(req.body.checks);
  if (!checks.every(Boolean))
    return res.status(400).json({ error: "请完成全部八项人工内容审核。" });
  db.prepare(
    "UPDATE lesson_versions SET status='reviewed',data=? WHERE id=? AND version=?",
  ).run(JSON.stringify({ ...JSON.parse(row.data), status: "reviewed" }), id, v);
  event(res.locals.userId, "content_reviewed", { id, version: v });
  res.json({ ok: true });
});
app.post("/v1/admin/content/:id/:version/publish", (req, res) => {
  const id = String(req.params.id),
    v = Number(req.params.version);
  const row = db
    .prepare("SELECT status FROM lesson_versions WHERE id=? AND version=?")
    .get(id, v) as { status: string } | undefined;
  if (row?.status !== "reviewed")
    return res.status(400).json({ error: "只有人工审核通过的版本可以发布。" });
  transaction(() => {
    db.prepare("UPDATE lesson_versions SET published=0 WHERE id=?").run(id);
    db.prepare(
      "UPDATE lesson_versions SET published=1 WHERE id=? AND version=?",
    ).run(id, v);
    event(res.locals.userId, "content_published", { id, version: v });
  });
  res.json({ ok: true });
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: "输入格式不正确，请检查后重试。",
        details: err.issues.map((i) => i.path.join(".")),
      });
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "录音文件过大，请保持在 8 MB 以内。" });
    console.error(err instanceof Error ? err.message : "Request failed");
    res.status(400).json({
      error: err instanceof Error ? err.message : "请求失败，请重试。",
    });
  },
);
app.listen(port, "0.0.0.0", () =>
  console.log(`Scene English API ready at http://localhost:${port}`),
);
