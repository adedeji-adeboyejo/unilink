import { createContext, useContext, useEffect, useState } from "react";
import { api, getSession, onSessionExpired, setSession } from "./api.js";
import { ToastHost, useLoad, Loading, Problem } from "./ui.jsx";
import Login from "./screens/Login.jsx";
import Plan from "./screens/Plan.jsx";
import MyCourses from "./screens/MyCourses.jsx";
import Catalogue from "./screens/Catalogue.jsx";
import Teaching from "./screens/Teaching.jsx";
import { AdminStudents, AdminInstructors } from "./screens/AdminPeople.jsx";
import AdminCourses from "./screens/AdminCourses.jsx";
import AdminSections from "./screens/AdminSections.jsx";
import AdminReports from "./screens/AdminReports.jsx";

// the currently selected term, shared with every screen
const TermCtx = createContext(null);
export const useTerm = () => useContext(TermCtx);

// Tabs for each role. "termed" screens show the term picker bar
// and get remounted whenever the term changes.
const SCREENS = {
  Student: [
    { id: "plan", label: "Plan my term", el: Plan, termed: true },
    { id: "courses", label: "My courses", el: MyCourses },
    { id: "catalogue", label: "Course catalogue", el: Catalogue },
  ],
  Instructor: [
    { id: "teaching", label: "My sections", el: Teaching, termed: true },
    { id: "catalogue", label: "Course catalogue", el: Catalogue },
  ],
  Admin: [
    { id: "sections", label: "Sections", el: AdminSections, termed: true },
    { id: "students", label: "Students", el: AdminStudents },
    { id: "instructors", label: "Instructors", el: AdminInstructors },
    { id: "courses", label: "Courses", el: AdminCourses },
    { id: "reports", label: "Reports", el: AdminReports, termed: true },
  ],
};

// "2025-01-06" -> "January 6, 2025"
// (noon so the date doesn't shift because of timezones)
const longDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export default function App() {
  const [user, setUser] = useState(getSession());
  const [expired, setExpired] = useState(false);

  // api.js calls this when the server says our token is no good anymore
  useEffect(() => onSessionExpired(() => {
    setUser(null);
    setExpired(true);
  }), []);

  if (!user) {
    return (
      <Login
        expired={expired}
        onLogin={(s) => {
          setSession(s);
          setUser(s);
          setExpired(false);
        }}
      />
    );
  }

  return (
    <ToastHost>
      <Shell
        user={user}
        onLogout={async () => {
          try {
            await api("/logout", { method: "POST" });
          } catch {
            // token was probably already gone, doesn't matter
          }
          setSession(null);
          setUser(null);
        }}
      />
    </ToastHost>
  );
}

function Shell({ user, onLogout }) {
  const screens = SCREENS[user.role];
  const [screenId, setScreenId] = useState(screens[0].id);
  const screen = screens.find((s) => s.id === screenId) || screens[0];

  const terms = useLoad(() => api("/terms"), []);
  const [termId, setTermId] = useState(null);

  // Pick a default term once they load: the one with registration open,
  // otherwise the current/next one, otherwise just the last one.
  useEffect(() => {
    if (!terms.data || termId) return;

    const today = new Date().toISOString().slice(0, 10);
    const pick =
      terms.data.find((t) => t.registration_open) ||
      terms.data.find((t) => t.end_date >= today) ||
      terms.data[terms.data.length - 1];

    setTermId(pick?.term_id);
  }, [terms.data, termId]);

  const term = terms.data?.find((t) => t.term_id === termId);
  const Screen = screen.el;

  return (
    <TermCtx.Provider value={{ term, terms: terms.data || [] }}>
      <div className="app">
        <header className="bar">
          <div className="bar-inner">
            <span className="brand">UniLink</span>

            <nav className="tabs" aria-label="Screens">
              {screens.map((s) => (
                <button
                  key={s.id}
                  className={`tab ${s.id === screen.id ? "is-on" : ""}`}
                  aria-current={s.id === screen.id ? "page" : undefined}
                  onClick={() => setScreenId(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="who">
              <span>
                <strong>{user.name}</strong> <span className="muted">{user.role}</span>
              </span>
              <button className="btn btn-quiet" onClick={onLogout}>Log out</button>
            </div>
          </div>
        </header>

        {screen.termed && (
          <div className="termline">
            <div className="termline-inner">
              <label className="term-pick">
                <span className="sr-only">Term</span>
                <select value={termId || ""} onChange={(e) => setTermId(e.target.value)}>
                  {(terms.data || []).map((t) => (
                    <option key={t.term_id} value={t.term_id}>{t.term_name}</option>
                  ))}
                </select>
              </label>

              {term && (
                <p className={`term-status ${term.registration_open ? "is-open" : ""}`}>
                  {term.registration_open ? (
                    <>Registration is open. Add or drop courses until <strong>{longDate(term.add_drop_deadline)}</strong>.</>
                  ) : (
                    <>Add/drop closed on {longDate(term.add_drop_deadline)}. Classes run {longDate(term.start_date)} to {longDate(term.end_date)}.</>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <main className="page">
          {terms.error ? (
            <Problem error={terms.error} onRetry={terms.reload} />
          ) : screen.termed && !term ? (
            <Loading what="Loading terms" />
          ) : (
            <Screen key={screen.id + (screen.termed ? term.term_id : "")} user={user} />
          )}
        </main>
      </div>
    </TermCtx.Provider>
  );
}
