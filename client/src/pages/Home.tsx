import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  Crosshair,
  Flame,
  Gauge,
  Gamepad2,
  Keyboard,
  Lock,
  Menu,
  Moon,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Difficulty = "BASIC" | "MEDIUM" | "HARD";
type TimerValue = number;
type Tab = "arena" | "analytics" | "history" | "settings";
type TestStatus = "ready" | "countdown" | "running" | "finished";

type Session = {
  id: string;
  date: string;
  difficulty: Difficulty;
  wpm: number;
  accuracy: number;
  errors: number;
  time: number;
  characters: number;
  correctCharacters: number;
  score: number;
  rank: string;
};

type AppSettings = {
  sound: boolean;
  animations: boolean;
  theme: "dark" | "light";
  defaultTimer: TimerValue;
  defaultDifficulty: Difficulty;
  keyboard: boolean;
  reducedMotion: boolean;
};

type AppState = {
  sessions: Session[];
  bestWpm: number;
  bestAccuracy: number;
  longestStreak: number;
  streak: number;
  totalCharacters: number;
  totalPracticeSeconds: number;
  dailyCount: number;
  dailyDate: string;
  settings: AppSettings;
  achievements: string[];
};

const STORAGE_KEY = "keyforge-state-v1";
const defaultSettings: AppSettings = {
  sound: false,
  animations: true,
  theme: "dark",
  defaultTimer: 60,
  defaultDifficulty: "MEDIUM",
  keyboard: true,
  reducedMotion: false,
};

const passages: Record<Difficulty, string[]> = {
  BASIC: [
    "The fastest typists are not the ones who rush. They are the ones who remain precise under pressure.",
    "A quiet rhythm turns every key into a deliberate move. Build the habit, then let speed follow.",
    "Small improvements compound. Stay patient, keep your eyes forward, and trust the next character.",
  ],
  MEDIUM: [
    "Precision is a form of momentum: every accurate keystroke clears the path for the next confident decision.",
    "When the signal is clear, the hands become an extension of thought. Train the rhythm, not just the result.",
    "Consistency beats intensity. Return to the arena often, measure honestly, and make one clean correction at a time.",
  ],
  HARD: [
    "07:42 // The forge wakes. Recalibrate your focus, parse the signal, and execute with absolute accuracy.",
    "Systems reward clarity under pressure: type with intent, recover from errors quickly, and never sacrifice control for noise.",
    "In the final sector, syntax matters: {speed} + precision != panic; deliberate inputs create exceptional output.",
  ],
};

const navItems: { id: Tab; label: string; sub: string; icon: LucideIcon }[] = [
  { id: "arena", label: "Training arena", sub: "Forge your speed", icon: Crosshair },
  { id: "analytics", label: "Analytics", sub: "Read the signal", icon: BarChart3 },
  { id: "history", label: "Progress log", sub: "Trace the climb", icon: Activity },
  { id: "settings", label: "System settings", sub: "Tune your rig", icon: Settings2 },
];

const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

function makeInitialState(): AppState {
  return {
    sessions: [],
    bestWpm: 0,
    bestAccuracy: 0,
    longestStreak: 0,
    streak: 0,
    totalCharacters: 0,
    totalPracticeSeconds: 0,
    dailyCount: 0,
    dailyDate: new Date().toISOString().slice(0, 10),
    settings: defaultSettings,
    achievements: [],
  };
}

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return makeInitialState();
    const parsed = JSON.parse(stored) as Partial<AppState>;
    const today = new Date().toISOString().slice(0, 10);
    return {
      ...makeInitialState(),
      ...parsed,
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      sessions: parsed.sessions ?? [],
      dailyCount: parsed.dailyDate === today ? parsed.dailyCount ?? 0 : 0,
      dailyDate: today,
    };
  } catch {
    return makeInitialState();
  }
}

function rankFor(wpm: number, accuracy: number) {
  if (wpm >= 100 && accuracy >= 98) return "S+";
  if (wpm >= 85 && accuracy >= 96) return "A+";
  if (wpm >= 70 && accuracy >= 93) return "A";
  if (wpm >= 50 && accuracy >= 88) return "B";
  return "C";
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function formatTimerLabel(value: TimerValue) {
  return value === Infinity ? "∞" : `${value}s`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Metric({ label, value, accent = "cyan", detail }: { label: string; value: string; accent?: "cyan" | "violet" | "orange"; detail?: string }) {
  return (
    <div className="metric-block">
      <div className="metric-label"><span className={`metric-dot ${accent}`} />{label}</div>
      <div className={`metric-value ${accent}`}>{value}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptySignal() {
  return (
    <div className="empty-signal">
      <div className="empty-orbit"><Command size={26} /></div>
      <div>
        <div className="empty-title">YOUR FORGE HAS NOT STARTED YET.</div>
        <div className="empty-copy">Complete your first session to unlock analytics and reveal your true signal.</div>
      </div>
    </div>
  );
}

function MiniChart({ sessions, metric }: { sessions: Session[]; metric: "wpm" | "accuracy" }) {
  const values = sessions.slice(0, 12).reverse().map((session) => metric === "wpm" ? session.wpm : session.accuracy);
  const chartValues = values.length ? values : metric === "wpm" ? [38, 44, 42, 51, 48, 61, 58] : [88, 91, 90, 94, 92, 96, 95];
  const min = Math.min(...chartValues) - 4;
  const max = Math.max(...chartValues) + 4;
  const points = chartValues.map((value, index) => `${(index / Math.max(1, chartValues.length - 1)) * 100},${100 - ((value - min) / Math.max(1, max - min)) * 82 - 8}`).join(" ");
  return (
    <div className="mini-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${metric} trend`} role="img">
        <defs>
          <linearGradient id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={metric === "wpm" ? "#55e6ff" : "#a78bfa"} stopOpacity=".24" />
            <stop offset="1" stopColor={metric === "wpm" ? "#55e6ff" : "#a78bfa"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,100 ${points} 100,100`} fill={`url(#fill-${metric})`} stroke="none" />
        <polyline points={points} fill="none" stroke={metric === "wpm" ? "#55e6ff" : "#a78bfa"} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-grid" />
    </div>
  );
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>("arena");
  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadState().settings.defaultDifficulty);
  const [timer, setTimer] = useState<TimerValue>(() => loadState().settings.defaultTimer);
  const [status, setStatus] = useState<TestStatus>("ready");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [inputText, setInputText] = useState("");
  const [passage, setPassage] = useState(() => passages.MEDIUM[0]);
  const [activeKey, setActiveKey] = useState("");
  const [result, setResult] = useState<Session | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef("");
  const passageRef = useRef(passage);
  const startTimeRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    document.documentElement.dataset.theme = appState.settings.theme;
    document.documentElement.dataset.motion = appState.settings.reducedMotion ? "reduced" : "full";
  }, [appState]);

  useEffect(() => {
    if (status !== "running") return;
    timerRef.current = window.setInterval(() => {
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(seconds);
      if (timer !== Infinity && seconds >= timer) finishTest(seconds);
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status, timer]);

  useEffect(() => {
    if (status === "countdown") {
      const id = window.setInterval(() => {
        setCountdown((value) => {
          if (value <= 1) {
            window.clearInterval(id);
            startTest();
            return 0;
          }
          return value - 1;
        });
      }, 700);
      return () => window.clearInterval(id);
    }
  }, [status]);

  useEffect(() => {
    const clearKey = window.setTimeout(() => setActiveKey(""), 160);
    return () => window.clearTimeout(clearKey);
  }, [activeKey]);

  function choosePassage(level = difficulty) {
    const options = passages[level];
    const next = options[Math.floor(Math.random() * options.length)];
    setPassage(next);
    passageRef.current = next;
  }

  function beginSession() {
    if (status === "running" || status === "countdown") return;
    choosePassage();
    setInputText("");
    inputValueRef.current = "";
    setElapsed(0);
    setResult(null);
    setCountdown(3);
    setStatus("countdown");
  }

  function startTest() {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setStatus("running");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function finishTest(duration = elapsed) {
    if (status !== "running") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    const typed = inputValueRef.current;
    const target = passageRef.current;
    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typed.length; i += 1) {
      if (typed[i] === target[i]) correct += 1;
      else errors += 1;
    }
    const totalTyped = typed.length;
    const minutes = Math.max(duration, 1) / 60;
    const wpm = Math.max(0, Math.round((correct / 5 / minutes) * 10) / 10);
    const accuracy = totalTyped ? Math.round((correct / totalTyped) * 1000) / 10 : 0;
    const score = Math.max(0, Math.round(wpm * (accuracy / 100) * 10));
    const session: Session = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      difficulty,
      wpm,
      accuracy,
      errors,
      time: Math.min(Math.round(duration), timer === Infinity ? Math.round(duration) : timer),
      characters: totalTyped,
      correctCharacters: correct,
      score,
      rank: rankFor(wpm, accuracy),
    };
    const personalBest = wpm > appState.bestWpm;
    const nextSessions = [session, ...appState.sessions].slice(0, 60);
    const newCount = appState.dailyCount + 1;
    const nextAchievements = new Set(appState.achievements);
    if (nextSessions.length >= 1) nextAchievements.add("first");
    if (wpm >= 80) nextAchievements.add("speed");
    if (accuracy >= 99) nextAchievements.add("precision");
    if (wpm >= 100) nextAchievements.add("century");
    if (newCount >= 10) nextAchievements.add("runner");
    setAppState((current) => ({
      ...current,
      sessions: nextSessions,
      bestWpm: Math.max(current.bestWpm, wpm),
      bestAccuracy: Math.max(current.bestAccuracy, accuracy),
      totalCharacters: current.totalCharacters + totalTyped,
      totalPracticeSeconds: current.totalPracticeSeconds + Math.round(duration),
      dailyCount: newCount,
      dailyDate: new Date().toISOString().slice(0, 10),
      streak: Math.max(current.streak, 1),
      longestStreak: Math.max(current.longestStreak, Math.max(current.streak, 1)),
      achievements: Array.from(nextAchievements),
    }));
    setStatus("finished");
    setResult({ ...session, id: personalBest ? `${session.id}-record` : session.id });
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (status !== "running") return;
    const value = event.currentTarget.value.slice(0, passageRef.current.length);
    setInputText(value);
    inputValueRef.current = value;
    if (value.length >= passageRef.current.length) finishTest((Date.now() - startTimeRef.current) / 1000);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") event.preventDefault();
    setActiveKey(event.key === " " ? "SPACE" : event.key.toUpperCase());
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setAppState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function resetAll() {
    const fresh = makeInitialState();
    setAppState(fresh);
    setDifficulty(fresh.settings.defaultDifficulty);
    setTimer(fresh.settings.defaultTimer);
    setResult(null);
    setStatus("ready");
  }

  const latest = appState.sessions[0];
  const averageWpm = appState.sessions.length ? Math.round((appState.sessions.reduce((sum, item) => sum + item.wpm, 0) / appState.sessions.length) * 10) / 10 : 0;
  const averageAccuracy = appState.sessions.length ? Math.round((appState.sessions.reduce((sum, item) => sum + item.accuracy, 0) / appState.sessions.length) * 10) / 10 : 0;
  const weakKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    appState.sessions.forEach((session) => {
      const sample = passages[session.difficulty][0];
      sample.toUpperCase().split("").forEach((char) => {
        if (/[A-Z]/.test(char)) counts[char] = (counts[char] ?? 0) + (session.errors > 2 ? 1 : 0);
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => key);
  }, [appState.sessions]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />
      <div className="scanline" />
      <header className="mobile-header">
        <div className="brand-lockup"><div className="brand-mark">K<span>F</span></div><div><div className="brand-name">KEY<span>//</span>FORGE</div><div className="brand-sub">PERSONAL TYPING ARENA</div></div></div>
        <button className="icon-button" aria-label="Open navigation" onClick={() => setShowMobileNav((value) => !value)}><Menu size={20} /></button>
      </header>
      {showMobileNav && <div className="mobile-nav-popover">{navItems.map((item) => <button key={item.id} className={classNames("mobile-nav-item", tab === item.id && "active")} onClick={() => { setTab(item.id); setShowMobileNav(false); }}><item.icon size={16} /><span>{item.label}</span></button>)}</div>}

      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">K<span>F</span></div>
          <div><div className="brand-name">KEY<span>//</span>FORGE</div><div className="brand-sub">PERSONAL TYPING ARENA</div></div>
        </div>
        <div className="system-status"><span className="online-dot" />SYSTEM ONLINE <span className="status-ping" /></div>
        <div className="sidebar-divider" />
        <div className="nav-section-label">OPERATIONS</div>
        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => <button key={item.id} className={classNames("nav-item", tab === item.id && "active")} onClick={() => setTab(item.id)}><item.icon size={17} strokeWidth={1.8} /><span><strong>{item.label}</strong><small>{item.sub}</small></span>{tab === item.id && <span className="nav-active-bar" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-icon"><Flame size={18} /></div><div><div className="tiny-label">CURRENT STREAK</div><div className="streak-number">{appState.streak || 0}<span> days</span></div></div><div className="streak-spark">↗</div></div>
          <div className="sidebar-footer"><span>v1.0.4 / LOCAL NODE</span><ShieldCheck size={14} /></div>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="breadcrumb"><span>COMMAND CENTER</span><ChevronRight size={13} /><span className="breadcrumb-current">{tab === "arena" ? "TRAINING ARENA" : tab === "analytics" ? "ANALYTICS" : tab === "history" ? "PROGRESS LOG" : "SYSTEM SETTINGS"}</span></div>
          <div className="topbar-actions"><div className="top-stat"><Flame size={14} /><span>STREAK</span><strong>{appState.streak}</strong></div><div className="top-stat"><Gauge size={14} /><span>BEST WPM</span><strong>{appState.bestWpm || "—"}</strong></div><button className="icon-button" title="Toggle theme" onClick={() => updateSettings({ theme: appState.settings.theme === "dark" ? "light" : "dark" })}>{appState.settings.theme === "dark" ? <Moon size={17} /> : <Sparkles size={17} />}</button><button className="avatar-button" onClick={() => setTab("settings")} aria-label="Open settings">KF</button></div>
        </div>

        {tab === "arena" && <ArenaView {...{ difficulty, setDifficulty, timer, setTimer, status, countdown, elapsed, inputText, passage, activeKey, beginSession, handleInput, handleKeyDown, inputRef, appState, latest, result, setResult, setStatus, setTab, updateSettings }} />}
        {tab === "analytics" && <AnalyticsView appState={appState} averageWpm={averageWpm} averageAccuracy={averageAccuracy} />}
        {tab === "history" && <HistoryView appState={appState} weakKeys={weakKeys} setTab={setTab} />}
        {tab === "settings" && <SettingsView settings={appState.settings} updateSettings={updateSettings} resetAll={resetAll} />}
      </main>
    </div>
  );
}

function ArenaView({ difficulty, setDifficulty, timer, setTimer, status, countdown, elapsed, inputText, passage, activeKey, beginSession, handleInput, handleKeyDown, inputRef, appState, latest, result, setResult, setStatus, setTab, updateSettings }: {
  difficulty: Difficulty; setDifficulty: (value: Difficulty) => void; timer: TimerValue; setTimer: (value: TimerValue) => void; status: TestStatus; countdown: number; elapsed: number; inputText: string; passage: string; activeKey: string; beginSession: () => void; handleInput: (event: ChangeEvent<HTMLInputElement>) => void; handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void; inputRef: React.RefObject<HTMLInputElement | null>; appState: AppState; latest?: Session; result: Session | null; setResult: (value: Session | null) => void; setStatus: (value: TestStatus) => void; setTab: (value: Tab) => void; updateSettings: (patch: Partial<AppSettings>) => void;
}) {
  const remaining = timer === Infinity ? Infinity : Math.max(0, timer - Math.floor(elapsed));
  const isLow = remaining !== Infinity && remaining <= 10 && status === "running";
  return (
    <div className="page page-arena">
      <section className="hero-block"><div><div className="eyebrow"><span className="eyebrow-line" />ACTIVE PROTOCOL / 01</div><h1>Forge your <em>speed.</em></h1><p>Precision first. Speed follows.</p></div><div className="hero-coordinates"><span>LAT 40.7128° N</span><span>NODE 07 — PERSONAL</span><span className="coordinate-live"><i />LIVE TELEMETRY</span></div></section>

      <section className="arena-panel glass-panel">
        <div className="panel-topline"><div className="panel-code"><span className="signal-icon"><Zap size={14} /></span><span>SESSION CONFIGURATION</span><b>//</b><span className="muted">READY STATE</span></div><div className="panel-id">RUN ID <strong>#{String(appState.sessions.length + 1).padStart(3, "0")}</strong></div></div>
        <div className="config-row"><div className="config-group"><div className="config-label">DIFFICULTY <span>SELECT TIER</span></div><div className="segmented">{(["BASIC", "MEDIUM", "HARD"] as Difficulty[]).map((level) => <button key={level} className={classNames(difficulty === level && "selected", level === "HARD" && "hard-option")} onClick={() => { setDifficulty(level); if (status === "ready") { /* keep controls responsive before launch */ } }}>{level}<small>{level === "BASIC" ? "01" : level === "MEDIUM" ? "02" : "03"}</small></button>)}</div></div><div className="config-group timer-group"><div className="config-label">TIME WINDOW <span>SECONDS</span></div><div className="segmented timer-segment">{([15, 30, 60, 120, Infinity] as TimerValue[]).map((value) => <button key={String(value)} className={timer === value ? "selected" : ""} onClick={() => setTimer(value)}>{formatTimerLabel(value)}</button>)}</div></div></div>

        <div className="hud-row">
          <Metric label="WORDS / MIN" value={status === "running" ? String(Math.round((Math.max(0, inputText.split(" ").length - (inputText ? 0 : 1)) / Math.max(elapsed / 60, 0.016)) * 10) / 10) : latest ? String(latest.wpm) : "00.0"} accent="cyan" detail="REAL-TIME VELOCITY" />
          <Metric label="ACCURACY" value={status === "running" ? String(inputText ? Math.round((inputText.split("").filter((char, index) => char === passage[index]).length / inputText.length) * 100) : 100) + "%" : latest ? String(latest.accuracy) + "%" : "100%"} accent="violet" detail="INPUT FIDELITY" />
          <Metric label="ERRORS" value={status === "running" ? String(inputText.split("").filter((char, index) => char !== passage[index]).length).padStart(2, "0") : latest ? String(latest.errors).padStart(2, "0") : "00"} accent="orange" detail="CORRECTION EVENTS" />
          <div className={classNames("timer-display", isLow && "low")}>
            <div className="timer-label">TIME REMAINING</div>
            <div className="timer-value">{remaining === Infinity ? "∞" : formatTime(remaining)}</div>
            <div className="timer-bar"><span style={{ width: String(timer === Infinity ? 12 : Math.max(2, (remaining / timer) * 100)) + "%" }} /></div>
          </div>
        </div>

        <div className="typing-zone"><div className="typing-zone-header"><span><Keyboard size={15} />TRANSMISSION STREAM</span><span className="typing-hint">{status === "running" ? "TYPE THE SIGNAL BELOW" : status === "countdown" ? "CALIBRATING INPUT..." : "AWAITING INPUT"}</span></div><div className={classNames("passage-card", status === "running" && "is-live", status === "countdown" && "is-countdown")}>
          {status === "countdown" && <div className="countdown-overlay"><div className="countdown-label">SYNCING TO FORGE</div><div className="countdown-number">{countdown > 0 ? countdown : "FORGE"}</div></div>}
          {status === "ready" && <div className="ready-overlay"><div className="ready-orbit"><Target size={25} /></div><div className="ready-title">READY TO FORGE?</div><div className="ready-copy">Your next clean run starts with one decisive move.</div><button className="primary-button" onClick={beginSession}><Play size={16} fill="currentColor" />START SESSION <span>↗</span></button></div>}
          <div className={classNames("passage-text", (status === "ready" || status === "countdown") && "passage-dimmed")} aria-label="Typing passage">{passage.split("").map((char, index) => { const typed = inputText[index]; const state = typed === undefined ? "pending" : typed === char ? "correct" : "incorrect"; return <span key={`${char}-${index}`} className={classNames(`char-${state}`, index === inputText.length && status === "running" && "char-current")}>{char === " " ? "\u00a0" : char}</span>; })}</div>
          <input ref={inputRef} className="typing-input" value={inputText} onChange={handleInput} onKeyDown={handleKeyDown} onPaste={(event) => event.preventDefault()} disabled={status !== "running"} aria-label="Type the passage" autoComplete="off" spellCheck={false} />
          {status === "running" && <div className="typing-live-indicator"><span className="online-dot" />LIVE — INPUT CAPTURED</div>}
        </div></div>

        {appState.settings.keyboard && <div className="keyboard-visualizer"><div className="keyboard-topline"><span>VIRTUAL DECK</span><span>ACTIVE KEY <strong>{activeKey || "—"}</strong></span></div>{keyboardRows.map((row, rowIndex) => <div className="key-row" key={rowIndex}>{row.map((key) => <div key={key} className={classNames("virtual-key", activeKey === key && "pressed", inputText.length > 0 && passage[inputText.length - 1]?.toUpperCase() === key && "last-hit")}>{key}</div>)}</div>)}<div className="key-row"><div className="virtual-key wide">SHIFT</div><div className="virtual-key spacebar">SPACE</div><div className="virtual-key wide">↵</div></div></div>}
        <div className="arena-footer"><div className="footer-tip"><CircleHelp size={14} /><span>Stay accurate. The metric only counts confirmed keystrokes.</span></div><div className="footer-actions">{status === "finished" && <button className="ghost-button" onClick={beginSession}><RotateCcw size={14} />RECALIBRATE</button>}<button className="sound-toggle" onClick={() => updateSettings({ sound: !appState.settings.sound })}>{appState.settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}SOUND {appState.settings.sound ? "ON" : "OFF"}</button></div></div>
      </section>
      <div className="below-grid"><section className="glass-panel forge-goal"><div className="card-heading"><div><div className="eyebrow"><span className="eyebrow-line" />DAILY OBJECTIVE</div><h2>Today's forge</h2></div><div className="goal-pct">{Math.min(100, appState.dailyCount * 20)}%</div></div><div className="goal-bar"><span style={{ width: `${Math.min(100, appState.dailyCount * 20)}%` }} /></div><div className="goal-meta"><span>{appState.dailyCount} / 5 sessions</span><span>{appState.dailyCount >= 5 ? "Protocol complete." : "One more round to complete today's forge."}</span></div></section><section className="glass-panel signal-card"><div className="card-heading"><div><div className="eyebrow"><span className="eyebrow-line violet" />LATEST SIGNAL</div><h2>{latest ? `${latest.wpm} WPM / ${latest.rank}` : "No signal yet"}</h2></div><Activity size={20} className="card-icon" /></div>{latest ? <MiniChart sessions={appState.sessions} metric="wpm" /> : <EmptySignal />}</section></div>
      {result && <ResultModal result={result} isRecord={result.wpm >= appState.bestWpm && result.wpm > 0} onClose={() => { setResult(null); setStatus("ready"); }} onAgain={() => { setResult(null); setStatus("ready"); beginSession(); }} onAnalytics={() => { setResult(null); setStatus("ready"); setTab("analytics"); }} />}
    </div>
  );
}

function ResultModal({ result, isRecord, onClose, onAgain, onAnalytics }: { result: Session; isRecord: boolean; onClose: () => void; onAgain: () => void; onAnalytics: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Session result"><div className={classNames("result-modal", isRecord && "record-modal")}><button className="modal-close" onClick={onClose} aria-label="Close result"><X size={18} /></button>{isRecord && <div className="confetti-field">{Array.from({ length: 18 }).map((_, index) => <i key={index} style={{ left: `${(index * 23) % 100}%`, animationDelay: `${(index % 7) * 80}ms` }} />)}</div>}<div className="result-kicker"><span className="online-dot" />{isRecord ? "NEW PERSONAL RECORD" : "ROUND COMPLETE"}</div><h2>{isRecord ? "Signal amplified." : "Clean transmission."}</h2><p className="result-sub">Your performance has been logged to the forge.</p><div className="result-primary"><div className="result-wpm">{result.wpm}<span>WPM</span></div><div className="rank-badge"><div>RANK</div><strong>{result.rank}</strong></div></div><div className="result-grid"><div><span>ACCURACY</span><strong>{result.accuracy}%</strong></div><div><span>ERRORS</span><strong>{String(result.errors).padStart(2, "0")}</strong></div><div><span>CHARACTERS</span><strong>{result.characters}</strong></div><div><span>TIME</span><strong>{result.time}s</strong></div></div><div className="result-note"><Sparkles size={15} />{isRecord ? "New personal best. The forge is getting hotter." : result.wpm > 0 ? "Keep the rhythm. One more round can change the signal." : "Accuracy first. Start a new run when you are ready."}</div><div className="result-actions"><button className="primary-button" onClick={onAgain}><RotateCcw size={15} />FORGE AGAIN <span>↗</span></button><button className="ghost-button" onClick={onAnalytics}><BarChart3 size={15} />VIEW ANALYTICS</button></div></div></div>;
}

function AnalyticsView({ appState, averageWpm, averageAccuracy }: { appState: AppState; averageWpm: number; averageAccuracy: number }) {
  const sessions = appState.sessions;
  return <div className="page"><SectionHeader eyebrow="PERFORMANCE TELEMETRY / 02" title="Read the signal." description="A clean view of how your inputs evolve under pressure." action={<div className="filter-pills"><button className="active">7 DAYS</button><button>30 DAYS</button><button>ALL TIME</button></div>} />
    <div className="stat-grid"><div className="stat-card cyan"><div className="stat-card-top"><span>PERSONAL BEST</span><Zap size={17} /></div><strong>{appState.bestWpm || "—"}</strong><small>WPM / peak velocity</small><MiniChart sessions={sessions} metric="wpm" /></div><div className="stat-card violet"><div className="stat-card-top"><span>AVG. ACCURACY</span><Target size={17} /></div><strong>{averageAccuracy ? `${averageAccuracy}%` : "—"}</strong><small>across all sessions</small><MiniChart sessions={sessions} metric="accuracy" /></div><div className="stat-card orange"><div className="stat-card-top"><span>TOTAL SESSIONS</span><Gamepad2 size={17} /></div><strong>{sessions.length}</strong><small>logged to local node</small><div className="stat-glyph">{sessions.length ? "↗" : "—"}</div></div><div className="stat-card green"><div className="stat-card-top"><span>PRACTICE TIME</span><Clock3 size={17} /></div><strong>{Math.round(appState.totalPracticeSeconds / 60)}<small>m</small></strong><small>time spent in the forge</small><div className="stat-glyph">◷</div></div></div>
    <div className="analytics-grid"><section className="glass-panel large-chart-card"><div className="card-heading"><div><div className="eyebrow"><span className="eyebrow-line" />VELOCITY TRACE</div><h2>WPM over time</h2></div><div className="chart-legend"><i />WPM <strong>{averageWpm || "—"}</strong></div></div>{sessions.length ? <LargeChart sessions={sessions} metric="wpm" /> : <EmptySignal />}</section><section className="glass-panel insight-card"><div className="eyebrow"><span className="eyebrow-line violet" />SYSTEM INSIGHT</div><div className="insight-orb"><BrainCircuit size={25} /></div><h2>{sessions.length ? "Your rhythm is forming." : "Your signal is waiting."}</h2><p>{sessions.length ? "Keep sessions short and deliberate. Consistency is the fastest route to a stable peak." : "Start a session in the arena and the system will begin mapping your performance."}</p><div className="insight-row"><span>TRAINING STATUS</span><strong className="green-text">{sessions.length ? "CALIBRATING" : "STANDBY"}</strong></div><div className="insight-row"><span>PEAK RANK</span><strong>{sessions[0]?.rank ?? "—"}</strong></div></section></div>
    <div className="analytics-bottom"><section className="glass-panel accuracy-panel"><div className="card-heading"><div><div className="eyebrow"><span className="eyebrow-line violet" />CONTROL LAYER</div><h2>Accuracy over time</h2></div><span className="chart-value violet-text">{averageAccuracy ? `${averageAccuracy}% avg` : "No data"}</span></div>{sessions.length ? <LargeChart sessions={sessions} metric="accuracy" /> : <EmptySignal />}</section><section className="glass-panel achievement-panel"><div className="card-heading"><div><div className="eyebrow"><span className="eyebrow-line orange" />MILESTONES</div><h2>Achievements</h2></div><Award size={20} className="card-icon" /></div><AchievementList unlocked={appState.achievements} /></section></div>
  </div>;
}

function LargeChart({ sessions, metric }: { sessions: Session[]; metric: "wpm" | "accuracy" }) {
  const values = sessions.slice(0, 18).reverse().map((session) => metric === "wpm" ? session.wpm : session.accuracy);
  const data = values.length ? values : [40, 45, 43, 49, 51];
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const pts = data.map((value, index) => ({ x: 4 + (index / Math.max(1, data.length - 1)) * 92, y: 86 - ((value - min) / Math.max(1, max - min)) * 68 }));
  const line = pts.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `4,90 ${line} 96,90`;
  return <div className="large-chart"><div className="chart-y-labels"><span>{Math.round(max)}</span><span>{Math.round((max + min) / 2)}</span><span>{Math.round(min)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id={`large-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={metric === "wpm" ? "#55e6ff" : "#a78bfa"} stopOpacity=".25" /><stop offset="1" stopColor={metric === "wpm" ? "#55e6ff" : "#a78bfa"} stopOpacity="0" /></linearGradient></defs><path d={`M ${area}`} fill={`url(#large-${metric})`} /><polyline points={line} fill="none" stroke={metric === "wpm" ? "#55e6ff" : "#a78bfa"} strokeWidth="1.1" vectorEffect="non-scaling-stroke" />{pts.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.4" fill={metric === "wpm" ? "#55e6ff" : "#a78bfa"} />)}</svg><div className="chart-x-labels"><span>EARLIEST</span><span>RECENT</span></div></div>;
}

const achievementData = [{ id: "first", title: "FIRST FORGE", detail: "Complete your first session.", icon: Sparkles }, { id: "speed", title: "SPEED DEMON", detail: "Reach 80 WPM.", icon: Zap }, { id: "precision", title: "PRECISION MASTER", detail: "Reach 99% accuracy.", icon: Target }, { id: "century", title: "CENTURY", detail: "Reach 100 WPM.", icon: Trophy }, { id: "runner", title: "NIGHT RUNNER", detail: "Complete 10 sessions.", icon: Gamepad2 }];
function AchievementList({ unlocked }: { unlocked: string[] }) { return <div className="achievement-list">{achievementData.map((achievement) => { const isUnlocked = unlocked.includes(achievement.id); return <div className={classNames("achievement-row", isUnlocked && "unlocked")} key={achievement.id}><div className="achievement-icon">{isUnlocked ? <achievement.icon size={17} /> : <Lock size={15} />}</div><div><strong>{achievement.title}</strong><span>{achievement.detail}</span></div>{isUnlocked && <Check size={16} className="achievement-check" />}</div>; })}</div>; }

function HistoryView({ appState, weakKeys, setTab }: { appState: AppState; weakKeys: string[]; setTab: (value: Tab) => void }) {
  return <div className="page"><SectionHeader eyebrow="ARCHIVE / 03" title="Trace the climb." description="Every clean run becomes part of your personal performance record." action={<button className="ghost-button" onClick={() => setTab("arena")}><Play size={14} />NEW SESSION</button>} />
    <div className="history-summary"><div><span>BEST WPM</span><strong>{appState.bestWpm || "—"}</strong></div><div><span>BEST ACCURACY</span><strong>{appState.bestAccuracy ? `${appState.bestAccuracy}%` : "—"}</strong></div><div><span>LONGEST STREAK</span><strong>{appState.longestStreak}<small> days</small></strong></div><div><span>CHARACTERS TYPED</span><strong>{appState.totalCharacters.toLocaleString()}</strong></div></div>
    {appState.sessions.length ? <section className="glass-panel table-panel"><div className="table-head"><span>SESSION LOG</span><span>{appState.sessions.length} RECORDS / LOCAL</span></div><div className="session-table"><div className="table-row table-header"><span>DATE</span><span>DIFFICULTY</span><span>WPM</span><span>ACCURACY</span><span>ERRORS</span><span>TIME</span><span>RANK</span></div>{appState.sessions.map((session) => <div className="table-row" key={session.id}><span>{dateLabel(session.date)}</span><span><i className={`difficulty-dot ${session.difficulty.toLowerCase()}`} />{session.difficulty}</span><strong>{session.wpm}</strong><span>{session.accuracy}%</span><span>{String(session.errors).padStart(2, "0")}</span><span>{session.time}s</span><b className={classNames("rank-pill", session.rank.startsWith("S") && "rank-s", session.rank.startsWith("A") && "rank-a")}>{session.rank}</b></div>)}</div></section> : <EmptySignal />}
    <div className="history-bottom"><section className="glass-panel weak-keys-card"><div className="eyebrow"><span className="eyebrow-line orange" />SMART PRACTICE</div><h2>Weak keys</h2><p>Your most frequent friction points will surface here as you train.</p><div className="weak-key-list">{(weakKeys.length ? weakKeys : ["E", "R", "T", "A"]).map((key) => <div className="weak-key" key={key}>{key}</div>)}</div><button className="primary-button" onClick={() => setTab("arena")}><BrainCircuit size={15} />PRACTICE WEAK KEYS <span>↗</span></button></section><section className="glass-panel achievements-history"><div className="eyebrow"><span className="eyebrow-line violet" />UNLOCK PATH</div><h2>Forge milestones</h2><AchievementList unlocked={appState.achievements} /></section></div>
  </div>;
}

function SettingsView({ settings, updateSettings, resetAll }: { settings: AppSettings; updateSettings: (patch: Partial<AppSettings>) => void; resetAll: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return <div className="page settings-page"><SectionHeader eyebrow="SYSTEM / 04" title="Tune your rig." description="Configure the arena around the way you focus best." /><div className="settings-layout"><div className="settings-column"><section className="glass-panel settings-panel"><div className="settings-panel-title"><div><div className="eyebrow"><span className="eyebrow-line" />FEEDBACK LAYER</div><h2>Experience</h2></div><Sparkles size={20} className="card-icon" /></div><SettingToggle label="Sound effects" detail="Subtle key, countdown, and completion feedback" active={settings.sound} onChange={() => updateSettings({ sound: !settings.sound })} icon={settings.sound ? Volume2 : VolumeX} /><SettingToggle label="Motion system" detail="Ambient particles and cinematic transitions" active={settings.animations} onChange={() => updateSettings({ animations: !settings.animations })} icon={Activity} /><SettingToggle label="Virtual keyboard" detail="Show the holographic deck beneath the passage" active={settings.keyboard} onChange={() => updateSettings({ keyboard: !settings.keyboard })} icon={Keyboard} /><SettingToggle label="Reduced motion" detail="Respect a calmer, lower-motion environment" active={settings.reducedMotion} onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })} icon={ShieldCheck} /></section><section className="glass-panel settings-panel"><div className="settings-panel-title"><div><div className="eyebrow"><span className="eyebrow-line violet" />PERSISTENCE</div><h2>Defaults</h2></div><Command size={20} className="card-icon" /></div><SelectSetting label="Default difficulty" value={settings.defaultDifficulty} options={["BASIC", "MEDIUM", "HARD"]} onChange={(value) => updateSettings({ defaultDifficulty: value as Difficulty })} /><SelectSetting label="Default timer" value={formatTimerLabel(settings.defaultTimer)} options={["15s", "30s", "60s", "120s", "∞"]} onChange={(value) => updateSettings({ defaultTimer: value === "∞" ? Infinity : Number.parseInt(value, 10) as TimerValue })} /></section></div><div className="settings-side"><section className="glass-panel theme-panel"><div className="eyebrow"><span className="eyebrow-line orange" />VISUAL PROFILE</div><h2>Forge theme</h2><div className="theme-choice"><button className={settings.theme === "dark" ? "selected" : ""} onClick={() => updateSettings({ theme: "dark" })}><div className="theme-swatch dark-swatch"><Moon size={19} /></div><span>DARK FORGE</span><small>Midnight / neon</small></button><button className={settings.theme === "light" ? "selected" : ""} onClick={() => updateSettings({ theme: "light" })}><div className="theme-swatch light-swatch"><Sparkles size={19} /></div><span>LIGHT FORGE</span><small>Polar / electric</small></button></div></section><section className="glass-panel danger-panel"><div className="eyebrow"><span className="eyebrow-line red" />RESET ZONE</div><h2>Wipe local signal</h2><p>Remove every stored session, achievement, streak, and personal best from this browser.</p>{confirm ? <div className="confirm-box"><strong>Are you sure?</strong><div><button className="danger-button" onClick={() => { resetAll(); setConfirm(false); }}>RESET EVERYTHING</button><button className="ghost-button" onClick={() => setConfirm(false)}>CANCEL</button></div></div> : <button className="danger-button" onClick={() => setConfirm(true)}><RotateCcw size={14} />RESET ALL STATISTICS</button>}</section><div className="settings-note"><Bell size={15} /><span>Your data never leaves this browser. KEY//FORGE is local by design.</span></div></div></div></div>;
}

function SettingToggle({ label, detail, active, onChange, icon: Icon }: { label: string; detail: string; active: boolean; onChange: () => void; icon: LucideIcon }) { return <button className="setting-toggle" onClick={onChange}><div className={classNames("setting-icon", active && "active")}><Icon size={17} /></div><div className="setting-copy"><strong>{label}</strong><span>{detail}</span></div><div className={classNames("toggle", active && "on")}><i /></div></button>; }
function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="select-setting"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
