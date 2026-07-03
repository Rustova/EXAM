import { useEffect, useRef, useState, useCallback } from "react";
import { X, Plus, ChevronsRight, Check, Cloud, CloudOff, Loader } from "lucide-react";

// ── Exam schedule ─────────────────────────────────────────────────────────────
const EXAMS = [
  { date: new Date(2026, 7, 24), label: "Pediatrics Paper¹",            short: "Ped P¹" },
  { date: new Date(2026, 8, 1),  label: "Pediatrics Paper² & OSPE",     short: "Ped P²" },
  { date: new Date(2026, 8, 9),  label: "Pediatrics OSCE",              short: "Ped OSCE" },
  { date: new Date(2026, 8, 17), label: "Psychiatry",                   short: "Psych" },
  { date: new Date(2026, 8, 21), label: "Psychiatry OSCE",              short: "Psych OSCE" },
  { date: new Date(2026, 8, 30), label: "OB/GYN Paper¹",               short: "OB P¹" },
  { date: new Date(2026, 9, 7),  label: "OB/GYN Paper² & OSPE",        short: "OB P²" },
  { date: new Date(2026, 9, 11), label: "OB/GYN OSCE",                 short: "OB OSCE" },
  { date: new Date(2026, 9, 18), label: "Family Medicine",              short: "FM" },
  { date: new Date(2026, 9, 22), label: "Family Medicine OSPE & OSCE", short: "FM OSCE" },
  { date: new Date(2026, 9, 29), label: "Internal Medicine Paper¹",    short: "IM P¹" },
  { date: new Date(2026, 10, 5), label: "Internal Medicine Paper² & OSPE", short: "IM P²" },
  { date: new Date(2026, 10, 9), label: "Internal Medicine OSCE",      short: "IM OSCE" },
  { date: new Date(2026, 10, 15),label: "Anaesthesia",                 short: "Anaes" },
  { date: new Date(2026, 10, 16),label: "Anaesthesia OSPE & OSCE",    short: "Anaes OSCE" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
// Task: { id, text, done, deferredFrom, deferCount }
// SyncState: "idle" | "saving" | "saved" | "error" | "unconfigured"

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function formatDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function formatFull(d) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Layout constants ──────────────────────────────────────────────────────────
const TODAY      = new Date();
const START      = EXAMS[0].date;
const END        = EXAMS[EXAMS.length - 1].date;
const DAYS_BEFORE = daysBetween(TODAY, START);
const BASE_PX_PER_DAY = 14;
const PADDING    = 80;
const NODE_R     = 7;
const EXAM_BOX   = 18;
const INTERVAL_R = 4;
const TODAY_R    = 10;
const SVG_H      = 240;
const TRACK_Y    = SVG_H / 2;
const MIN_ZOOM   = 0.6;
const MAX_ZOOM   = 4;

const EXAM_KEYS = new Set(EXAMS.map(e => toKey(e.date)));

// ── Storage via localStorage (persists in this browser only) ──────────────────
const STORAGE_KEY = "exam-timeline-tasks";

async function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

async function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Task Panel ────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDefer, onDelete }) {
  return (
    <li className="group flex items-center gap-3 px-5 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
      <button onClick={onToggle}
        className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
          task.done ? "bg-black border-black" : "border-black hover:bg-neutral-100"
        }`}>
        {task.done && <Check size={10} strokeWidth={3} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-mono tracking-wide block truncate ${
          task.done ? "line-through text-neutral-300" : "text-black"
        }`}>
          {task.text}
        </span>
        {(task.deferredFrom || task.deferCount > 0) && (
          <span className="text-[9px] tracking-wide text-neutral-400 flex items-center gap-1 mt-0.5">
            <ChevronsRight size={9} />
            deferred{task.deferCount > 1 ? ` ×${task.deferCount}` : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!task.done && onDefer && (
          <button onClick={onDefer} title="Defer to next day"
            className="p-1 text-neutral-400 hover:text-black transition-colors">
            <ChevronsRight size={13} />
          </button>
        )}
        <button onClick={onDelete} title="Delete"
          className="p-1 text-red-500 hover:text-red-700 transition-colors">
          <X size={11} />
        </button>
      </div>
    </li>
  );
}

// ── Today Box (inline, below timeline) ─────────────────────────────────────
function TodayBox({ date, tasks, onAdd, onToggle, onDefer, onDelete }) {
  const [input, setInput] = useState("");
  function submit() {
    const t = input.trim(); if (!t) return;
    onAdd(t); setInput("");
  }
  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);
  const isExam  = EXAM_KEYS.has(toKey(date));
  const isToday = toKey(date) === toKey(TODAY);

  return (
    <div id="tasks-box" className="mt-8 w-full max-w-md border border-black rounded-2xl overflow-hidden shadow-sm scroll-mt-8">
      <div className="flex items-start justify-between border-b border-black px-5 py-4">
        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase text-neutral-400 mb-0.5">
            {formatFull(date)}
          </p>
          <h2 className="text-sm font-bold tracking-widest uppercase text-black flex items-center gap-2">
            {isToday ? "Tasks Today" : "Tasks Selected"}
            {isExam && (
              <span className="text-[8px] border border-black rounded-full px-2 py-0.5 tracking-widest font-normal">
                EXAM DAY
              </span>
            )}
          </h2>
        </div>
        <span className="text-[9px] tracking-widest uppercase text-neutral-400 mt-1">
          {pending.length} pending
        </span>
      </div>

      <div className="flex border-b border-black">
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Add a task…"
          className="flex-1 px-5 py-3 text-sm font-mono tracking-wide outline-none placeholder:text-neutral-300 bg-white"
        />
        <button onClick={submit}
          className="px-4 border-l border-black text-green-600 hover:bg-green-600 hover:text-white transition-colors">
          <Plus size={15} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-center text-[10px] tracking-widest uppercase text-neutral-300 py-10">
            No tasks for this day
          </p>
        )}
        {pending.length > 0 && (
          <ul>
            {pending.map(task => (
              <TaskRow key={task.id} task={task}
                onToggle={() => onToggle(task.id)}
                onDefer={() => onDefer(task.id)}
                onDelete={() => onDelete(task.id)} />
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <>
            <div className="px-5 pt-4 pb-1">
              <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-300">
                Completed · {done.length}
              </span>
            </div>
            <ul>
              {done.map(task => (
                <TaskRow key={task.id} task={task}
                  onToggle={() => onToggle(task.id)}
                  onDefer={() => onDefer(task.id)}
                  onDelete={() => onDelete(task.id)} />
              ))}
            </ul>
          </>
        )}
      </div>

      {pending.length > 0 && (
        <div className="border-t border-black px-5 py-3 flex items-center justify-end">
          <button onClick={() => pending.forEach(t => onDefer(t.id))}
            className="text-[9px] tracking-widest uppercase text-neutral-400 hover:text-black flex items-center gap-1 transition-colors">
            <ChevronsRight size={11} /> Defer all
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [blink, setBlink]           = useState(true);
  const [hovered, setHovered]       = useState(null);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [tasks, setTasks]           = useState({});
  const [syncState, setSyncState]   = useState("idle");
  const [zoom, setZoom]             = useState(4);
  const [now, setNow]               = useState(() => new Date());
  const saveTimer                   = useRef(null);
  const scrollRef                   = useRef(null);
  const pinchState                  = useRef(null);

  // live clock, ticks every second — drives the "next event" countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // find the next exam that hasn't happened yet (auto-advances as each passes)
  const nextExam = EXAMS.find(e => e.date.getTime() > now.getTime()) ?? null;
  let countdown = null;
  if (nextExam) {
    const diffMs = nextExam.date.getTime() - now.getTime();
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdown = { days, hours, minutes, seconds };
  }

  const pxPerDay = BASE_PX_PER_DAY * zoom;
  function xOf(date) {
    return PADDING + daysBetween(START, date) * pxPerDay;
  }
  // fractional days elapsed since START, using live clock so the marker
  // creeps forward smoothly through each day rather than jumping once daily
  const startMidnight = new Date(START.getFullYear(), START.getMonth(), START.getDate());
  const fractionalDaysFromStart = (now.getTime() - startMidnight.getTime()) / 86400000;
  const rawTodayX   = PADDING + fractionalDaysFromStart * pxPerDay;
  const finalTodayX = Math.max(20, rawTodayX);
  const totalWidth  = Math.max(xOf(END), finalTodayX) + PADDING;

  function clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)); }

  function zoomAt(newZoom, anchorClientX) {
    const el = scrollRef.current;
    if (!el) { setZoom(clampZoom(newZoom)); return; }
    const rect = el.getBoundingClientRect();
    const anchorOffsetInEl = (anchorClientX ?? rect.left + rect.width / 2) - rect.left;
    const contentX = el.scrollLeft + anchorOffsetInEl;
    const ratio = clampZoom(newZoom) / zoom;
    setZoom(clampZoom(newZoom));
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = contentX * ratio - anchorOffsetInEl;
    });
  }

  // ctrl/cmd + wheel to zoom (trackpad pinch also fires wheel with ctrlKey)
  function handleWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.01);
    zoomAt(zoom * factor, e.clientX);
  }

  // touch pinch
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchState.current = { dist, zoom, midX: (a.clientX + b.clientX) / 2 };
    }
  }
  function handleTouchMove(e) {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const midX = (a.clientX + b.clientX) / 2;
      const newZoom = pinchState.current.zoom * (dist / pinchState.current.dist);
      zoomAt(newZoom, midX);
    }
  }
  function handleTouchEnd(e) {
    if (e.touches.length < 2) pinchState.current = null;
  }

  // load on mount
  useEffect(() => {
    setSyncState("saving");
    loadTasks()
      .then(t => { setTasks(t); setSyncState("saved"); })
      .catch(() => setSyncState("error"));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 700);
    return () => clearInterval(id);
  }, []);

  const persist = useCallback((newTasks) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await saveTasks(newTasks);
        setSyncState("saved");
      } catch {
        setSyncState("error");
      }
    }, 600);
  }, []);

  function mutate(updater) {
    setTasks(prev => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }

  const addTask = (date, text) => {
    const key = toKey(date);
    mutate(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []), { id: uid(), text, done: false, deferCount: 0 }],
    }));
  };

  const toggleTask = (date, id) => {
    const key = toKey(date);
    mutate(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).map(t => t.id === id ? { ...t, done: !t.done } : t),
    }));
  };

  const deleteTask = (date, id) => {
    const key = toKey(date);
    mutate(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(t => t.id !== id) }));
  };

  const deferTask = (date, id) => {
    const key     = toKey(date);
    const nextKey = toKey(addDays(date, 1));
    mutate(prev => {
      const task = (prev[key] ?? []).find(t => t.id === id);
      if (!task) return prev;
      return {
        ...prev,
        [key]: (prev[key] ?? []).filter(t => t.id !== id),
        [nextKey]: [
          ...(prev[nextKey] ?? []),
          { ...task, id: uid(), done: false, deferredFrom: task.deferredFrom ?? key, deferCount: task.deferCount + 1 },
        ],
      };
    });
  };

  function tasksFor(date) { return tasks[toKey(date)] ?? []; }
  function pendingFor(date) { return tasksFor(date).filter(t => !t.done).length; }
  function totalFor(date)   { return tasksFor(date).length; }

  const selTasks = tasksFor(selectedDate);

  function selectDay(date) {
    setSelectedDate(date);
    const el = document.getElementById("tasks-box");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const intervalGroups = [];
  for (let i = 0; i < EXAMS.length - 1; i++) {
    const gap = daysBetween(EXAMS[i].date, EXAMS[i + 1].date);
    const days = [];
    for (let d = 1; d < gap; d++) days.push(addDays(EXAMS[i].date, d));
    intervalGroups.push({ examIdx: i, days });
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-mono select-none px-4 py-12">
      {/* ── Header ── */}
      <div className="mb-10 text-center relative w-full max-w-3xl">
        <h1 className="text-2xl font-bold tracking-[0.25em] uppercase text-black">
          Exam Schedule
        </h1>
        <p className="text-xs tracking-widest text-neutral-400 mt-1 uppercase">
          Academic Year 2026 — Countdown Timeline
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 flex-wrap">
          <div className="inline-flex items-center gap-2 border border-black rounded-full px-4 py-1.5 text-xs tracking-widest uppercase">
            <span
              className="inline-block w-2 h-2 rounded-full bg-black"
              style={{ opacity: blink ? 1 : 0.2, transition: "opacity 0.2s" }}
            />
            Today: {formatDate(TODAY)}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] tracking-widest uppercase border transition-colors ${
            syncState === "error"  ? "border-black text-black" :
            syncState === "saving" ? "border-neutral-300 text-neutral-400" :
            "border-neutral-200 text-neutral-300"
          }`}>
            {syncState === "saving" && <Loader size={9} className="animate-spin" />}
            {syncState === "saved"  && <Cloud size={9} />}
            {syncState === "error"  && <CloudOff size={9} />}
            {syncState === "saving" ? "Saving…"
              : syncState === "saved" ? "Saved"
              : syncState === "error" ? "Save failed" : "—"}
          </div>
        </div>

        {countdown && (
          <div className="mt-4 inline-flex flex-col items-center gap-1">
            <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-400">
              Next: {nextExam.label}
            </span>
            <div className="flex items-center gap-2 text-red-600 font-bold tabular-nums text-lg tracking-wider">
              <span>{countdown.days}<span className="text-[10px] font-normal ml-0.5">d</span></span>
              <span className="text-neutral-300">:</span>
              <span>{String(countdown.hours).padStart(2, "0")}<span className="text-[10px] font-normal ml-0.5">h</span></span>
              <span className="text-neutral-300">:</span>
              <span>{String(countdown.minutes).padStart(2, "0")}<span className="text-[10px] font-normal ml-0.5">m</span></span>
              <span className="text-neutral-300">:</span>
              <span>{String(countdown.seconds).padStart(2, "0")}<span className="text-[10px] font-normal ml-0.5">s</span></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Zoom controls ── */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => zoomAt(zoom / 1.4)}
          className="w-7 h-7 rounded-full border border-black flex items-center justify-center text-sm hover:bg-black hover:text-white transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <span className="text-[9px] tracking-widest uppercase text-neutral-400 w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomAt(zoom * 1.4)}
          className="w-7 h-7 rounded-full border border-black flex items-center justify-center text-sm hover:bg-black hover:text-white transition-colors"
          title="Zoom in"
        >
          +
        </button>
        {zoom !== 4 && (
          <button
            onClick={() => zoomAt(4)}
            className="text-[9px] tracking-widest uppercase text-neutral-400 hover:text-black transition-colors rounded-full px-2 py-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto pb-4 touch-pan-x"
        style={{ maxWidth: "100vw" }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          width={totalWidth + 100}
          height={SVG_H}
          style={{ display: "block", minWidth: totalWidth + 100 }}
        >
          <line
            x1={finalTodayX - 20} y1={TRACK_Y}
            x2={xOf(END) + 20}    y2={TRACK_Y}
            stroke="#e5e5e5" strokeWidth={1}
          />

          {intervalGroups.map(({ examIdx, days }) => {
            const x1 = xOf(EXAMS[examIdx].date);
            const x2 = xOf(EXAMS[examIdx + 1].date);
            const gapDays = daysBetween(EXAMS[examIdx].date, EXAMS[examIdx + 1].date);
            const midX = (x1 + x2) / 2;
            const isAboveLabel = examIdx % 2 === 0;

            return (
              <g key={examIdx}>
                <line
                  x1={x1 + NODE_R + 2} y1={TRACK_Y}
                  x2={x2 - NODE_R - 2} y2={TRACK_Y}
                  stroke="#ccc" strokeWidth={1.5} strokeDasharray="5 4"
                />
                {gapDays > 1 && (
                  <text
                    x={midX} y={isAboveLabel ? TRACK_Y - 34 : TRACK_Y + 42}
                    textAnchor="middle" fontSize={8.5} fill="#dc2626"
                    letterSpacing={1} fontFamily="monospace" fontWeight="bold"
                  >
                    +{gapDays}d
                  </text>
                )}

                {days.map((day, di) => {
                  const key = toKey(day);
                  const dx  = xOf(day);
                  const isHov  = hovered === key;
                  const isSel  = toKey(selectedDate) === key;
                  const total  = totalFor(day);
                  const pending = pendingFor(day);
                  const hasTasks = total > 0;
                  const r = isHov || isSel ? INTERVAL_R + 1.5 : INTERVAL_R;

                  const tickUp = di % 2 === 0;
                  const labelOffset = r + 10;

                  return (
                    <g key={key}
                      onMouseEnter={() => setHovered(key)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => selectDay(day)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={dx - Math.max(6, pxPerDay / 2)} y={TRACK_Y - 20}
                        width={Math.max(12, pxPerDay)} height={40}
                        fill="transparent"
                      />
                      <circle
                        cx={dx} cy={TRACK_Y} r={r}
                        fill={hasTasks ? (pending > 0 ? "#dc2626" : "#bbb") : "#fff"}
                        stroke={isHov || isSel ? "#000" : hasTasks ? "#000" : "#ccc"}
                        strokeWidth={isHov || isSel ? 1.5 : 1}
                        style={{ transition: "all 0.15s ease" }}
                      />
                      {(isHov || zoom >= 2) && (
                        <text
                          x={dx}
                          y={tickUp ? TRACK_Y - labelOffset : TRACK_Y + labelOffset + 6}
                          textAnchor="middle" fontSize={7.5}
                          fill={isHov ? "#000" : "#999"} fontFamily="monospace"
                        >
                          {formatDate(day)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {EXAMS.map((exam, i) => {
            const x       = xOf(exam.date);
            const key     = toKey(exam.date);
            const isHov   = hovered === key;
            const isSel   = toKey(selectedDate) === key;
            const total   = totalFor(exam.date);
            const pending = pendingFor(exam.date);
            const isAbove = i % 2 === 0;
            const boxSize = isHov ? EXAM_BOX + 3 : EXAM_BOX;
            const tickY1  = isAbove ? TRACK_Y - boxSize / 2 - 2 : TRACK_Y + boxSize / 2 + 2;
            const tickY2  = isAbove ? TRACK_Y - 18 : TRACK_Y + 18;

            // card dimensions for the label+date chip above/below the node
            const cardW = 68, cardH = 42, cardGap = 6;
            const cardX = x - cardW / 2;
            const cardY = isAbove ? tickY2 - cardGap - cardH : tickY2 + cardGap;

            return (
              <g key={i}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => selectDay(exam.date)}
                style={{ cursor: "pointer" }}
              >
                <line
                  x1={x} y1={tickY1} x2={x} y2={tickY2}
                  stroke={isHov || isSel ? "#000" : "#aaa"} strokeWidth={isHov || isSel ? 1.5 : 1}
                />
                {isSel && (
                  <rect
                    x={x - boxSize / 2 - 5} y={TRACK_Y - boxSize / 2 - 5}
                    width={boxSize + 10} height={boxSize + 10}
                    rx={6} fill="none" stroke="#000" strokeWidth={1} opacity={0.3}
                  />
                )}
                <rect
                  x={x - boxSize / 2} y={TRACK_Y - boxSize / 2}
                  width={boxSize} height={boxSize}
                  rx={3}
                  fill="#000"
                  stroke="#000" strokeWidth={1.5}
                  style={{ transition: "all 0.15s ease", filter: isHov ? "drop-shadow(0 3px 6px rgba(0,0,0,0.35))" : "none" }}
                />
                {total > 0 && (
                  <g>
                    <circle
                      cx={x + boxSize / 2}
                      cy={TRACK_Y - boxSize / 2}
                      r={5}
                      fill={pending > 0 ? "#000" : "#fff"}
                      stroke="#fff" strokeWidth={1}
                    />
                    <text
                      x={x + boxSize / 2} y={TRACK_Y - boxSize / 2 + 3.5}
                      textAnchor="middle" fontSize={5.5} fill={pending > 0 ? "#fff" : "#000"}
                      fontFamily="monospace" fontWeight="bold"
                    >
                      {total}
                    </text>
                  </g>
                )}

                {/* card with bold white exam label + date */}
                <rect
                  x={cardX} y={cardY} width={cardW} height={cardH}
                  rx={6} fill="#000"
                  style={{ transition: "all 0.15s ease" }}
                />
                <text
                  x={x} y={cardY + 17}
                  textAnchor="middle" fontSize={10.5} fill="#fff"
                  fontFamily="monospace" fontWeight="900" letterSpacing={0.3}
                >
                  {exam.short}
                </text>
                <text
                  x={x} y={cardY + 30}
                  textAnchor="middle" fontSize={9} fill="#fff"
                  fontFamily="monospace" fontWeight="900" letterSpacing={0.3}
                >
                  {formatDate(exam.date)}
                </text>
              </g>
            );
          })}

          <line
            x1={finalTodayX + TODAY_R + 2} y1={TRACK_Y}
            x2={xOf(START) - NODE_R - 2}   y2={TRACK_Y}
            stroke="#444" strokeWidth={1} strokeDasharray="3 7"
          />

          <circle
            cx={finalTodayX} cy={TRACK_Y} r={TODAY_R + 6}
            fill="none" stroke="#000" strokeWidth={1}
            opacity={blink ? 0.2 : 0}
            style={{ transition: "opacity 0.4s ease" }}
          />
          <circle
            cx={finalTodayX} cy={TRACK_Y} r={TODAY_R}
            fill="#000"
            opacity={blink ? 1 : 0.4}
            style={{ transition: "opacity 0.4s ease" }}
          />
          <circle cx={finalTodayX} cy={TRACK_Y} r={3} fill="#fff" />
          <text
            x={finalTodayX} y={TRACK_Y - 24}
            textAnchor="middle" fontSize={8} fill="#000"
            fontFamily="monospace" letterSpacing={2} fontWeight="bold"
          >
            TODAY
          </text>
          <text
            x={finalTodayX} y={TRACK_Y - 13}
            textAnchor="middle" fontSize={7.5} fill="#555" fontFamily="monospace"
          >
            {formatDate(TODAY)}
          </text>
        </svg>
      </div>

      <p className="mt-3 text-[9px] tracking-widest uppercase text-neutral-300 text-center px-4">
        Tap a day or exam to view its tasks below · pinch or ctrl+scroll to zoom
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-6 text-[9px] tracking-widest uppercase text-neutral-400">
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-[1px] border-t border-dashed border-neutral-300" />
          Interval
        </span>
        <span className="flex items-center gap-2">
          <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="none" stroke="#ccc" strokeWidth={1}/></svg>
          Day
        </span>
        <span className="flex items-center gap-2">
          <svg width={12} height={12}><rect x={0} y={0} width={12} height={12} rx={2} fill="#000"/></svg>
          Exam
        </span>
        <span className="flex items-center gap-2">
          <svg width={8} height={8}><circle cx={4} cy={4} r={3} fill="#000"/></svg>
          Has pending tasks
        </span>
      </div>

      {/* ── Tasks box (bound to selected day, defaults to today) ── */}
      <TodayBox
        date={selectedDate}
        tasks={selTasks}
        onAdd={text => addTask(selectedDate, text)}
        onToggle={id => toggleTask(selectedDate, id)}
        onDefer={id => deferTask(selectedDate, id)}
        onDelete={id => deleteTask(selectedDate, id)}
      />
    </div>
  );
}
