import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { Code, Empty, Loading, Problem, useLoad } from "../ui.jsx";

export default function MyCourses() {
  const { terms } = useTerm();
  const profile = useLoad(() => api("/student/profile"), []);
  const rows = useLoad(() => api("/student/enrollments"), []);

  const termName = (id) => terms.find((t) => t.term_id === id)?.term_name || id;

  // group enrollments by term, newest term first
  const byTerm = [];
  for (const r of rows.data || []) {
    let g = byTerm.find((x) => x.term_id === r.term_id);
    if (!g) byTerm.push((g = { term_id: r.term_id, rows: [] }));
    g.rows.push(r);
  }
  byTerm.reverse();

  const completed = (rows.data || []).filter((r) => r.status === "Completed");
  const earned = completed.reduce((n, r) => n + Number(r.credits), 0);

  return (
    <div className="narrow">
      <h1 className="h1">My courses</h1>

    <p>
      <br/>
    </p>

      <Problem error={rows.error || profile.error} onRetry={rows.reload} />
      {rows.loading && <Loading />}
      {rows.data && rows.data.length === 0 && (
        <Empty>You haven't registered for any courses yet. Use Plan my term to find sections.</Empty>
      )}

      {byTerm.map((g) => (
        <section key={g.term_id} className="term-group">
          <h2 className="h2">{termName(g.term_id)}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Title</th>
                <th>Section</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.enrollment_id} className={r.status === "Dropped" ? "is-dropped" : ""}>
                  <td><Code code={r.course_code} size="s" /></td>
                  <td>{r.title}</td>
                  <td className="num">{r.section_number}</td>
                  <td className="num">{Number(r.credits)}</td>
                  <td>
                    <span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span>
                    {r.drop_date && <span className="muted"> on {r.drop_date.slice(0, 10)}</span>}
                  </td>
                  <td className="grade">{r.grade || <span className="muted">None yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
