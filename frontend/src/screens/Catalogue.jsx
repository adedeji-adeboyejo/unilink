import { useState } from "react";
import { api } from "../api.js";
import { Code, Empty, Loading, Problem, useLoad } from "../ui.jsx";

export default function Catalogue() {
  const [dept, setDept] = useState("");
  const depts = useLoad(() => api("/departments"), []);
  const courses = useLoad(() => api("/courses", { query: { dept_id: dept } }), [dept]);

  return (
    <div className="narrow">
      <div className="head-row">
        <h1 className="h1">Course catalogue</h1>
        <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {(depts.data || []).map((d) => (
            <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
          ))}
        </select>
      </div>

      <Problem error={courses.error} onRetry={courses.reload} />
      {courses.loading && <Loading />}
      {courses.data?.length === 0 && <Empty>No courses in this department yet.</Empty>}

      <dl className="catalogue">
        {(courses.data || []).map((c) => (
          <div key={c.course_code} className="cat-item">
            <dt>
              <Code code={c.course_code} size="l" />
              <span className="cat-title">{c.title}</span>
            </dt>
            <dd>
              <p>{c.description}</p>
              <p className="muted">
                {Number(c.credits)} credits.{" "}
                {/* backend says "(min C)", reword it to "(grade C or higher)" */}
                {c.prerequisites ? (
                  <>Requires {c.prerequisites.replaceAll("(min ", "(grade ").replaceAll(")", " or higher)")}.</>
                ) : (
                  "No prerequisites."
                )}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
