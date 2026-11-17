import { useState } from "react";
import { Field } from "./ui.jsx";

export function RecordForm({ fields, initial = {}, submitLabel, onSubmit, children }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? f.default ?? ""]))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    // empty inputs become null, number inputs become actual numbers
    const out = {};
    for (const f of fields) {
      let v = values[f.name];
      if (f.type === "number") v = v === "" ? null : Number(v);
      if (v === "") v = null;
      out[f.name] = v;
    }

    try {
      await onSubmit(out);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint} wide={f.wide}>
            {f.type === "select" ? (
              <select
                value={values[f.name] ?? ""}
                required={f.required}
                onChange={(e) => set(f.name, e.target.value)}
              >
                {!f.required && <option value="">{f.empty || "None"}</option>}
                {f.required && values[f.name] === "" && (
                  <option value="" disabled>Choose one</option>
                )}
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                rows={3}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : (
              <input
                type={f.type || "text"}
                value={values[f.name] ?? ""}
                required={f.required}
                min={f.min}
                max={f.max}
                step={f.step}
                minLength={f.minLength}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </Field>
        ))}
      </div>

      {error && <p className="problem" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="btn btn-ink" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}
