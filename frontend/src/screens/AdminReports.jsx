import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { Code, Empty, Loading, Problem, useLoad } from "../ui.jsx";

export default function AdminReports() {
  const { term, terms } = useTerm();
  const report = useLoad(
    () => api("/admin/reports/enrollment", { query: { term_id: term.term_id } }),
    [term.term_id]
  );
  const full = useLoad(() => api("/admin/reports/full-sections"), []);

  const termName = (id) => terms.find((t) => t.term_id === id)?.term_name || id;

  // totals for the summary line
  const rows = report.data || [];
  const seats = rows.reduce((n, r) => n + r.enrollment_limit, 0);
  const taken = rows.reduce((n, r) => n + r.enrolled, 0);

  return (
    <div className="reports">
      <section>
        <h1 className="h1">How full each section is</h1>
        {rows.length > 0 && (
          <p className="lede">
            {taken} of {seats} seats are taken across {rows.length} sections in {term.term_name}.
          </p>
        )}
        <Problem error={report.error} onRetry={report.reload} />
        {report.loading && <Loading />}
        {report.data?.length === 0 && <Empty>No sections are scheduled in {term.term_name}.</Empty>}

        <table className="table bars">
          <caption className="sr-only">Enrollment by section, {term.term_name}</caption>
          {rows.length > 0 && (
            <thead>
              <tr>
                <th>Section</th>
                <th>Seats taken</th>
                <th className="num">Full</th>
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((r) => {
              const pct = Number(r.percent_full);

              return (
                <tr
                  key={r.section_id}
                  title={`${r.course_code} section ${r.section_number}: ${r.enrolled} of ${r.enrollment_limit} seats taken`}
                >
                  <td className="bar-label">
                    <Code code={r.course_code} size="s" /> <span className="muted">sec {r.section_number}</span>
                  </td>
                  <td>
                    <div className="bar-cell">
                      <div className={`rbar ${pct >= 100 ? "rbar-full" : ""}`} aria-hidden="true">
                        <div className="rbar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="bar-count">{r.enrolled} of {r.enrollment_limit}</span>
                    </div>
                  </td>
                  <td className="num">
                    {pct >= 100 ? <strong className="full-word">Full</strong> : `${pct}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="aside-report">
        <h2 className="h2">Sections that may need another section</h2>
        <p className="muted">Full sections in current and upcoming terms.</p>
        <Problem error={full.error} onRetry={full.reload} />
        {full.loading && <Loading />}
        {full.data?.length === 0 && <Empty>No section is full right now.</Empty>}

        <ul className="rows">
          {(full.data || []).map((r) => (
            <li key={r.section_id}>
              <span>
                <Code code={r.course_code} size="s" /> sec {r.section_number}, {termName(r.term_id)}
              </span>
              <span className="muted">{r.enrolled} of {r.enrollment_limit}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
