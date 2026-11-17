import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DAYS, DAY_NAMES, fmt } from "./time.js";

// Runs an async loader and tracks data / error / loading.
// Returns reload() too so screens can refetch after a change.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const run = useCallback(() => {
    // ignore results that come back after the component moved on
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState({ data: null, error, loading: false })
    );

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { ...state, reload: run };
}

// Toasts

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Small shared components

export function Problem({ error, onRetry }) {
  if (!error) return null;

  return (
    <div className="problem" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button className="btn btn-quiet" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export const Loading = ({ what = "Loading" }) => <p className="muted loading">{what}…</p>;

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

// "COMP 3150" -> dept and number styled separately
export function Code({ code, size = "m" }) {
  const [dept, num] = String(code).split(" ");

  return (
    <span className={`code code-${size}`}>
      <span className="code-dept">{dept}</span>
      <span className="code-num">{num}</span>
    </span>
  );
}

// Bar showing how many seats are taken. The number is always in the text too,
// not just the bar width.
export function SeatMeter({ enrolled, limit, compact }) {
  const pct = limit ? Math.min(100, (enrolled / limit) * 100) : 0;
  const left = Math.max(0, limit - enrolled);
  const full = left === 0;

  return (
    <div
      className={`meter ${full ? "meter-full" : ""} ${compact ? "meter-compact" : ""}`}
      title={`${enrolled} of ${limit} seats taken`}
    >
      <div className="meter-track" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="meter-text">
        {full ? <strong>Full</strong> : <><strong>{left}</strong> of {limit} seats left</>}
      </span>
    </div>
  );
}

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Slide-out panel on the right, used for editing stuff in the admin screens.
// Closes on Escape or clicking the backdrop, and gives focus back when it closes.
export function Drawer({ title, sub, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();

    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="drawer-head">
          <div>
            <h2 className="drawer-title">{title}</h2>
            {sub && <p className="muted">{sub}</p>}
          </div>
          <button className="btn btn-quiet" onClick={onClose}>Close</button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

// Delete/drop buttons go through this so you have to click twice
export function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  busy,
  className = "btn btn-danger",
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={busy}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm">
      <span>{question}</span>
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

// Weekly timetable

const HOUR_PX = 52;

export function Timetable({ blocks, onBlockClick, caption }) {
  // show 8am-6pm by default, but stretch it if a class goes outside that
  let from = 8 * 60;
  let to = 18 * 60;
  for (const b of blocks) {
    from = Math.min(from, Math.floor(b.start / 60) * 60);
    to = Math.max(to, Math.ceil(b.end / 60) * 60);
  }

  const hours = [];
  for (let h = from; h < to; h += 60) hours.push(h);

  const height = ((to - from) / 60) * HOUR_PX;
  const y = (m) => ((m - from) / 60) * HOUR_PX;

  return (
    <figure className="tt" aria-label={caption || "Weekly timetable"}>
      <div className="tt-head">
        <span />
        {DAYS.map((d) => (
          <span key={d} className="tt-day">
            <abbr title={DAY_NAMES[d]}>{d}</abbr>
          </span>
        ))}
      </div>

      <div className="tt-body" style={{ height }}>
        <div className="tt-gutter">
          {hours.map((h) => (
            <span key={h} style={{ top: y(h) }}>{fmt(h)}</span>
          ))}
        </div>

        {DAYS.map((d) => (
          <div key={d} className="tt-col">
            {hours.map((h) => (
              <span key={h} className="tt-rule" style={{ top: y(h) }} />
            ))}
            {hours.map((h) => (
              <span key={h + "h"} className="tt-rule tt-rule-half" style={{ top: y(h + 30) }} />
            ))}

            {blocks.filter((b) => b.day === d).map((b, i) => {
              // only your own classes are clickable
              const Tag = onBlockClick && b.kind === "enrolled" ? "button" : "div";

              return (
                <Tag
                  key={b.key || i}
                  className={`tt-block tt-${b.kind}`}
                  style={{ top: y(b.start), height: Math.max(22, y(b.end) - y(b.start)) }}
                  onClick={Tag === "button" ? () => onBlockClick(b) : undefined}
                  aria-label={`${b.code} ${DAY_NAMES[d]} ${fmt(b.start)} to ${fmt(b.end)}${b.room ? ", " + b.room : ""}${b.kind === "conflict" ? ", overlaps a class you have" : ""}`}
                >
                  <span className="tt-code">{b.code}</span>
                  <span className="tt-meta">
                    {fmt(b.start)}–{fmt(b.end)}{b.room ? `, ${b.room}` : ""}
                  </span>
                </Tag>
              );
            })}
          </div>
        ))}
      </div>

      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  );
}
