import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { DAYS, DAY_NAMES, overlaps, parseSchedule, scheduleLabel, toMin } from "../time.js";
import {
  Code,
  ConfirmButton,
  Empty,
  Loading,
  Problem,
  SeatMeter,
  Timetable,
  useLoad,
  useToast,
} from "../ui.jsx";

// waits until the user stops typing before the value updates,
// so we're not firing a search request on every keystroke
function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return v;
}

export default function Plan() {
  const { term } = useTerm();
  const toast = useToast();

  // search filters
  const [keyword, setKeyword] = useState("");
  const [dept, setDept] = useState("");
  const [day, setDay] = useState("");
  const [instructor, setInstructor] = useState("");
  const kw = useDebounced(keyword);
  const ins = useDebounced(instructor);

  const depts = useLoad(() => api("/departments"), []);
  const sections = useLoad(
    () =>
      api("/sections", {
        query: { term_id: term.term_id, keyword: kw, dept_id: dept, day, instructor: ins },
      }),
    [term.term_id, kw, dept, day, ins]
  );
  const schedule = useLoad(
    () => api("/student/schedule", { query: { term_id: term.term_id } }),
    [term.term_id]
  );
  const enrollments = useLoad(() => api("/student/enrollments"), []);

  const [hovered, setHovered] = useState(null);
  const [open, setOpen] = useState(null);
  const [rowError, setRowError] = useState({});
  const [busy, setBusy] = useState(null);

  // what the student is currently registered in for this term
  const mine = useMemo(
    () =>
      (enrollments.data || []).filter(
        (e) => e.term_id === term.term_id && e.status === "Enrolled"
      ),
    [enrollments.data, term.term_id]
  );
  const enrolledIds = new Set(mine.map((e) => e.section_id));
  const credits = mine.reduce((n, e) => n + Number(e.credits), 0);

  // you can only be in one section of a course, so this is used to show
  // "you're already in section 2" on the other sections
  const enrolledCourse = new Map(mine.map((e) => [e.course_code, e.section_number]));

  const myMeetings = useMemo(
    () =>
      (schedule.data || []).map((m) => ({
        day: m.day_of_week,
        start: toMin(m.start_time),
        end: toMin(m.end_time),
        code: m.course_code,
        room: m.room,
        section_id: m.section_id,
      })),
    [schedule.data]
  );

  // which of my classes would this section overlap with?
  const clashesFor = (s) => {
    if (enrolledIds.has(s.section_id)) return [];

    const found = [];
    for (const m of parseSchedule(s.schedule)) {
      for (const c of myMeetings) {
        if (overlaps(m, c)) found.push({ code: c.code, day: m.day });
      }
    }
    return found;
  };

  // The section being hovered (or the expanded one) gets drawn on the
  // timetable too, in red if it clashes with something.
  const previewId = hovered ?? open;
  const previewSection = (sections.data || []).find((s) => s.section_id === previewId);

  const blocks = [
    ...myMeetings.map((m, i) => ({ ...m, kind: "enrolled", key: "e" + i })),
    ...(previewSection && !enrolledIds.has(previewSection.section_id)
      ? parseSchedule(previewSection.schedule).map((m, i) => ({
          ...m,
          code: previewSection.course_code,
          key: "p" + i,
          kind: myMeetings.some((c) => overlaps(m, c)) ? "conflict" : "preview",
        }))
      : []),
  ];

  const refresh = () => {
    sections.reload();
    schedule.reload();
    enrollments.reload();
  };

  async function register(s) {
    setBusy(s.section_id);
    setRowError((e) => ({ ...e, [s.section_id]: null }));

    try {
      const r = await api("/student/enrollments", {
        method: "POST",
        body: { section_id: s.section_id },
      });
      const left = r.section?.seats_left;
      toast(`Registered in ${s.course_code}, section ${s.section_number}. ${left} ${left === 1 ? "seat" : "seats"} left.`);
      refresh();
    } catch (err) {
      setRowError((e) => ({ ...e, [s.section_id]: err.message }));
    } finally {
      setBusy(null);
    }
  }

  async function drop(s) {
    setBusy(s.section_id);
    setRowError((e) => ({ ...e, [s.section_id]: null }));

    try {
      await api(`/student/enrollments/${s.section_id}`, { method: "DELETE" });
      toast(`Dropped ${s.course_code}, section ${s.section_number}.`);
      refresh();
    } catch (err) {
      setRowError((e) => ({ ...e, [s.section_id]: err.message }));
    } finally {
      setBusy(null);
    }
  }

  const closed = !term.registration_open;

  return (
    <div className="plan">
      <section className="plan-list" aria-labelledby="find-h">
        <h1 id="find-h" className="h1">Find sections</h1>

        <div className="filters">
          <input
            type="search"
            aria-label="Course code or title"
            placeholder="Course code or title"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="filter-kw"
          />
          <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {(depts.data || []).map((d) => (
              <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
            ))}
          </select>
          <select aria-label="Meets on" value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">Any day</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>Meets {DAY_NAMES[d]}</option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Instructor"
            placeholder="Instructor"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
        </div>

        <Problem error={sections.error} onRetry={sections.reload} />
        {sections.loading && !sections.data && <Loading what="Searching" />}
        {sections.data && sections.data.length === 0 && (
          <Empty>No sections in {term.term_name} match that search. Try a shorter keyword or clear the filters.</Empty>
        )}

        <ol className="sections" onMouseLeave={() => setHovered(null)}>
          {(sections.data || []).map((s) => {
            const isMine = enrolledIds.has(s.section_id);
            const otherSection = !isMine && enrolledCourse.get(s.course_code);
            const clashes = clashesFor(s);
            const isOpen = open === s.section_id;

            return (
              <li
                key={s.section_id}
                className={`sec ${isMine ? "is-mine" : ""} ${previewId === s.section_id ? "is-preview" : ""}`}
                onMouseEnter={() => setHovered(s.section_id)}
                onFocus={() => setHovered(s.section_id)}
              >
                <div className="sec-main">
                  <button
                    className="sec-toggle"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : s.section_id)}
                  >
                    <Code code={s.course_code} />
                    <span className="sec-title">{s.title}</span>
                  </button>

                  <div className="sec-facts">
                    <span>Section {s.section_number}</span>
                    <span>{scheduleLabel(s.schedule)}</span>
                    <span>{s.instructor}</span>
                    <span>{Number(s.credits)} credits</span>
                  </div>

                  <SeatMeter enrolled={s.enrolled} limit={s.enrollment_limit} />

                  {isMine && <p className="sec-note sec-note-mine">You're registered in this section.</p>}
                  {otherSection && (
                    <p className="sec-note">You're already in section {otherSection} of this course.</p>
                  )}
                  {clashes.length > 0 && (
                    <p className="sec-note sec-note-clash">
                      Overlaps {clashText(clashes)}.
                    </p>
                  )}
                  {s.status === "Closed" && (
                    <p className="sec-note">This section is closed to registration.</p>
                  )}
                  {rowError[s.section_id] && (
                    <p className="problem" role="alert">{rowError[s.section_id]}</p>
                  )}
                </div>

                <div className="sec-act">
                  {isMine ? (
                    <ConfirmButton
                      label="Drop"
                      confirmLabel="Drop course"
                      question={`Drop ${s.course_code}?`}
                      className="btn btn-line"
                      busy={busy === s.section_id || closed}
                      onConfirm={() => drop(s)}
                    />
                  ) : s.seats_left <= 0 || s.status !== "Open" ? (
                    <button className="btn btn-line" disabled>
                      {s.status === "Closed" ? "Closed" : "Section full"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-ink"
                      onClick={() => register(s)}
                      disabled={busy === s.section_id || closed}
                      title={closed ? "Registration for this term is closed" : undefined}
                    >
                      {busy === s.section_id ? "Registering…" : "Register"}
                    </button>
                  )}
                </div>

                {isOpen && <SectionDetails id={s.section_id} />}
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="plan-week" aria-labelledby="week-h">
        <div className="week-head">
          <h2 id="week-h" className="h2">My week</h2>
          <p className="muted">
            {mine.length === 0
              ? "No courses yet this term."
              : `${mine.length} ${mine.length === 1 ? "course" : "courses"}, ${credits} credits`}
          </p>
        </div>
        <Problem error={schedule.error} onRetry={schedule.reload} />
        <Timetable blocks={blocks} />
        <ul className="legend">
          <li><span className="key key-enrolled" aria-hidden="true" /> Registered</li>
          <li><span className="key key-preview" aria-hidden="true" /> Section you're looking at</li>
          <li><span className="key key-conflict" aria-hidden="true" /> Time conflict</li>
        </ul>
      </aside>
    </div>
  );
}

// Builds the "overlaps ..." text. Example:
//   [{ code: "COMP 3340", day: "Tue" }, { code: "COMP 3340", day: "Thu" }]
//   -> "COMP 3340 on Tuesday and Thursday"
function clashText(clashes) {
  const byCode = new Map();

  for (const c of clashes) {
    const days = byCode.get(c.code) || [];
    if (!days.includes(DAY_NAMES[c.day])) days.push(DAY_NAMES[c.day]);
    byCode.set(c.code, days);
  }

  return [...byCode].map(([code, days]) => `${code} on ${days.join(" and ")}`).join(", and ");
}

// extra info shown when you click a section to expand it
function SectionDetails({ id }) {
  const d = useLoad(() => api(`/sections/${id}`), [id]);

  if (d.loading) return <div className="sec-details"><Loading /></div>;
  if (d.error) return <div className="sec-details"><Problem error={d.error} /></div>;

  const s = d.data;

  return (
    <div className="sec-details">
      <div>
        <h3 className="h3">Meets</h3>
        {s.meetings.length === 0 ? (
          <p className="muted">No meeting times yet.</p>
        ) : (
          <ul className="plain">
            {s.meetings.map((m) => (
              <li key={m.meeting_id}>
                {DAY_NAMES[m.day_of_week]} {m.start_time.slice(0, 5)}–{m.end_time.slice(0, 5)}, {m.room}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="h3">Prerequisites</h3>
        {s.prerequisites.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="plain">
            {s.prerequisites.map((p) => (
              <li key={p.course_code}>
                {p.course_code} {p.title}, grade {p.min_grade} or higher
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
