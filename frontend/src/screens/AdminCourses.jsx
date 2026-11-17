import { useState } from "react";
import { api, enc } from "../api.js";
import { RecordForm } from "../form.jsx";
import { Code, ConfirmButton, Drawer, Empty, Field, Loading, Problem, useLoad, useToast } from "../ui.jsx";

const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-"];

export default function AdminCourses() {
  const toast = useToast();
  const list = useLoad(() => api("/courses"), []);
  const depts = useLoad(() => api("/departments"), []);
  const [editing, setEditing] = useState(null); // a course row, or "new"

  const deptOptions = (depts.data || []).map((d) => ({ value: d.dept_id, label: d.dept_name }));

  // course code can only be set when creating (it's the primary key)
  const fields = (isNew) => [
    ...(isNew
      ? [{ name: "course_code", label: "Course code", required: true, hint: "Department, a space, then the number: COMP 4150" }]
      : []),
    { name: "title", label: "Title", required: true, wide: true },
    { name: "description", label: "Description", type: "textarea", wide: true },
    { name: "credits", label: "Credits", type: "number", step: 0.5, min: 0.5, default: 3, required: true },
    { name: "dept_id", label: "Department", type: "select", required: true, options: deptOptions },
  ];

  return (
    <div>
      <div className="head-row">
        <h1 className="h1">Courses</h1>
        <button className="btn btn-ink" onClick={() => setEditing("new")}>Add course</button>
      </div>

      <Problem error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Loading />}
      {list.data?.length === 0 && <Empty>There are no courses yet. Add the first one.</Empty>}

      {list.data?.length > 0 && (
        <table className="table table-click">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Credits</th>
              <th>Prerequisites</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((c) => (
              <tr
                key={c.course_code}
                tabIndex={0}
                onClick={() => setEditing(c)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(c)}
              >
                <td><Code code={c.course_code} size="s" /></td>
                <td>{c.title}</td>
                <td className="num">{Number(c.credits)}</td>
                <td>{c.prerequisites || <span className="muted">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing === "new" && (
        <Drawer title="Add course" onClose={() => setEditing(null)}>
          <RecordForm
            fields={fields(true)}
            submitLabel="Add course"
            onSubmit={async (v) => {
              await api("/admin/courses", {
                method: "POST",
                body: { ...v, course_code: v.course_code.trim().toUpperCase() },
              });
              toast(`Added ${v.course_code.toUpperCase()}.`);
              setEditing(null);
              list.reload();
            }}
          />
        </Drawer>
      )}

      {editing && editing !== "new" && (
        <Drawer title={editing.course_code} sub={editing.title} onClose={() => setEditing(null)}>
          <RecordForm
            key={editing.course_code}
            fields={fields(false)}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (v) => {
              await api(`/admin/courses/${enc(editing.course_code)}`, { method: "PUT", body: v });
              toast("Course saved.");
              list.reload();
            }}
          >
            <ConfirmButton
              label="Delete course"
              confirmLabel="Delete"
              question="Delete this course?"
              onConfirm={async () => {
                try {
                  await api(`/admin/courses/${enc(editing.course_code)}`, { method: "DELETE" });
                  toast("Course deleted.");
                  setEditing(null);
                  list.reload();
                } catch (err) {
                  toast(err.message, "bad");
                }
              }}
            />
          </RecordForm>

          <Prerequisites code={editing.course_code} courses={list.data} onChange={list.reload} />
        </Drawer>
      )}
    </div>
  );
}

function Prerequisites({ code, courses, onChange }) {
  const toast = useToast();

  // There's no separate endpoint for this, so parse it out of the course list.
  // It comes back as "COMP 2540 (min C), MATH 1020 (min D)"
  const prereqs = useLoad(async () => {
    const c = courses.find((x) => x.course_code === code);
    if (!c?.prerequisites) return [];

    return c.prerequisites.split(", ").map((p) => {
      const m = p.match(/^(.+) \(min (.+)\)$/);
      return { course_code: m[1], min_grade: m[2] };
    });
  }, [code, courses]);

  const [pick, setPick] = useState("");
  const [grade, setGrade] = useState("C");
  const [error, setError] = useState("");

  async function add(e) {
    e.preventDefault();
    setError("");

    try {
      await api(`/admin/courses/${enc(code)}/prerequisites`, {
        method: "POST",
        body: { prereq_course_code: pick, min_grade: grade },
      });
      toast(`${pick} is now required for ${code}.`);
      setPick("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(p) {
    try {
      await api(`/admin/courses/${enc(code)}/prerequisites/${enc(p)}`, { method: "DELETE" });
      toast(`${p} is no longer required.`);
      onChange();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  // don't offer courses that are already prereqs
  const have = new Set((prereqs.data || []).map((p) => p.course_code));

  return (
    <section className="drawer-section">
      <h3 className="h2">Prerequisites</h3>
      {prereqs.data?.length === 0 && (
        <p className="muted">Students can take {code} without any earlier course.</p>
      )}

      <ul className="rows">
        {(prereqs.data || []).map((p) => (
          <li key={p.course_code}>
            <span><Code code={p.course_code} size="s" /> with {p.min_grade} or higher</span>
            <button className="btn btn-line btn-small" onClick={() => remove(p.course_code)}>Remove</button>
          </li>
        ))}
      </ul>

      <form className="inline-form" onSubmit={add}>
        <Field label="Course" wide>
          <select value={pick} required onChange={(e) => setPick(e.target.value)}>
            <option value="" disabled>Choose a course</option>
            {courses
              .filter((c) => c.course_code !== code && !have.has(c.course_code))
              .map((c) => (
                <option key={c.course_code} value={c.course_code}>{c.course_code} {c.title}</option>
              ))}
          </select>
        </Field>
        <Field label="Minimum grade">
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <button className="btn btn-ink" disabled={!pick}>Add prerequisite</button>
      </form>

      {error && <p className="problem" role="alert">{error}</p>}
    </section>
  );
}
