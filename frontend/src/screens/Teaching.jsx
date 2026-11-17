import { useState } from "react";
import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { parseSchedule, scheduleLabel } from "../time.js";
import { Code, Empty, Loading, Problem, SeatMeter, Timetable, useLoad } from "../ui.jsx";

export default function Teaching() {
  const { term } = useTerm();
  const sections = useLoad(
    () => api("/instructor/sections", { query: { term_id: term.term_id } }),
    [term.term_id]
  );
  const [selected, setSelected] = useState(null);

  // one timetable block per meeting of each section
  const blocks = (sections.data || []).flatMap((s) =>
    parseSchedule(s.schedule).map((m, i) => ({
      ...m,
      code: `${s.course_code} sec ${s.section_number}`,
      kind: "enrolled",
      key: `${s.section_id}-${i}`,
      section_id: s.section_id,
    }))
  );

  const pick = (id) => setSelected(sections.data.find((s) => s.section_id === id));

  return (
    <div className="plan">
      <section className="plan-list">
        <h1 className="h1">Sections I teach</h1>
        <Problem error={sections.error} onRetry={sections.reload} />
        {sections.loading && <Loading />}
        {sections.data?.length === 0 && (
          <Empty>You aren't assigned to any sections in {term.term_name}.</Empty>
        )}

        <ol className="sections">
          {(sections.data || []).map((s) => (
            <li
              key={s.section_id}
              className={`sec ${selected?.section_id === s.section_id ? "is-preview" : ""}`}
            >
              <div className="sec-main">
                <div className="sec-toggle sec-toggle-static">
                  <Code code={s.course_code} />
                  <span className="sec-title">{s.title}</span>
                </div>
                <div className="sec-facts">
                  <span>Section {s.section_number}</span>
                  <span>{scheduleLabel(s.schedule)}</span>
                  <span>{s.enrolled} enrolled</span>
                </div>
                <SeatMeter enrolled={s.enrolled} limit={s.enrollment_limit} />
              </div>
              <div className="sec-act">
                <button className="btn btn-ink" onClick={() => pick(s.section_id)}>Class list</button>
              </div>
              {selected?.section_id === s.section_id && <ClassList section={s} />}
            </li>
          ))}
        </ol>
      </section>

      <aside className="plan-week">
        <div className="week-head">
          <h2 className="h2">Teaching week</h2>
          <p className="muted">Select a class to see who's enrolled.</p>
        </div>
        <Timetable blocks={blocks} onBlockClick={(b) => pick(b.section_id)} />
      </aside>
    </div>
  );
}

function ClassList({ section }) {
  const list = useLoad(
    () => api(`/instructor/sections/${section.section_id}/students`),
    [section.section_id]
  );

  return (
    <div className="sec-details sec-details-full">
      <h3 className="h3">Class list</h3>
      <Problem error={list.error} onRetry={list.reload} />
      {list.loading && <Loading />}
      {list.data?.length === 0 && <p className="muted">No students have registered yet.</p>}

      {list.data?.length > 0 && (
        <table className="table table-tight">
          <thead>
            <tr>
              <th>Student number</th>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((st) => (
              <tr key={st.student_id}>
                <td className="id">{st.student_id}</td>
                <td>{st.last_name}, {st.first_name}</td>
                <td><a href={`mailto:${st.email}`}>{st.email}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="muted">
        <Code code={section.course_code} size="s" /> section {section.section_number}: {list.data?.length ?? "…"} of {section.enrollment_limit} seats taken.
      </p>
    </div>
  );
}
