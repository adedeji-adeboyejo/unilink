import { useState } from "react";
import { api } from "../api.js";

// accounts from the sample data, handy for testing/demoing
const DEMO = [
  { role: "Student", username: "aisha.khan", name: "Aisha Khan" },
  { role: "Instructor", username: "grace.okafor", name: "Dr. Grace Okafor" },
  { role: "Admin", username: "linda.carter", name: "Linda Carter, Registrar" },
];

export default function Login({ onLogin, expired }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(expired ? "Your session ended. Log in again to continue." : "");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      onLogin(await api("/login", { method: "POST", body: { username, password } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-col">
        <header className="login-head">
          <h1 className="login-title">Uni<span>Link</span></h1>        </header>

        <form className="login-card" onSubmit={submit}>
          <h2 className="login-sub">Log in</h2>

          <label className="field">
            <span className="field-label">Username</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="problem" role="alert">{error}</p>}

          <button className="btn btn-ink btn-block" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>

          <details className="demo">
            <summary>Demo accounts</summary>
            <ul>
              {DEMO.map((d) => (
                <li key={d.username}>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => {
                      // all the sample accounts use the same password
                      setUsername(d.username);
                      setPassword("password123");
                    }}
                  >
                    {d.name}
                  </button>
                  <span className="muted"> {d.role.toLowerCase()}, {d.username}</span>
                </li>
              ))}
            </ul>
          </details>
        </form>
      </div>
    </main>
  );
}
