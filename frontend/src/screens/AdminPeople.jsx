import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { RecordForm } from "../form.jsx";
import { scheduleLabel } from "../time.js";
import { Code, ConfirmButton, Drawer, Empty, Field, Loading, Problem, useLoad, useToast } from "../ui.jsx";

const deptOptions = (d) => (d || []).map((x) => ({ value: x.dept_id, label: x.dept_name }));

// ---- Students ----

export function AdminStudents() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // wait a bit after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const list = useLoad(() => api("/admin/students", { query: { search: q } }), [q]);
  const depts = useLoad(() => api("/departments"), []);
  const [editing, setEditing] = useState(null); // student row, or "new"

  const fields = (isNew) => [
    ...(isNew ? [{ name: "student_id", label: "Student number", type: "number", required: true }] : []),
    { name: "first_name", label: "First name", required: true },
    { name: "last_name", label: "Last name", required: true },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      wide: true,
      hint: isNew ? "Their username will be the part before the @." : undefined,
    },
    { name: "phone", label: "Phone" },
    { name: "date_of_birth", label: "Date of birth", type: "date" },
    { name: "year_level", label: "Year", type: "number", min: 1, max: 6, default: 1, required: true },
    { name: "major_dept_id", label: "Major", type: "select", options: deptOptions(depts.data), empty: "Undeclared" },
    // password only when creating, editing it isn't supported here
    ...(isNew
      ? [{
          name: "password",
          label: "Starting password",
          type: "password",
          required: true,
          minLength: 8,
          hint: "At least 8 characters.",
        }]
      : []),
  ];

  return (
    <div>
      <div className="head-row">
        <h1 className="h1">Students</h1>
        <input
          type="search"
          aria-label="Search students"
          placeholder="Search by name or student number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-ink" onClick={() => setEditing("new")}>Add student</button>
      </div>

      <Problem error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Loading />}
      {list.data?.length === 0 && <Empty>No students match “{q}”.</Empty>}

      {list.data?.length > 0 && (
        <table className="table table-click">
          <thead>
            <tr>
              <th>Student number</th>
              <th>Name</th>
              <th>Email</th>
              <th>Year</th>
              <th>Major</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((s) => (
              <tr
                key={s.student_id}
                tabIndex={0}
                onClick={() => setEditing(s)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(s)}
              >
                <td className="id">{s.student_id}</td>
                <td><strong>{s.last_name}, {s.first_name}</strong></td>
                <td>{s.email}</td>
                <td className="num">{s.year_level}</td>
                <td>{s.major_dept_id || <span className="muted">Undeclared</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing === "new" && (
        <Drawer title="Add student" onClose={() => setEditing(null)}>
          <RecordForm
            fields={fields(true)}
            submitLabel="Add student"
            onSubmit={async (v) => {
              const r = await api("/admin/students", { method: "POST", body: v });
              toast(`Added ${v.first_name} ${v.last_name}. They log in as ${r.username}.`);
              setEditing(null);
              list.reload();
            }}
          />
        </Drawer>
      )}

      {editing && editing !== "new" && (
        <Drawer
          title={`${editing.first_name} ${editing.last_name}`}
          sub={`Student ${editing.student_id}`}
          onClose={() => setEditing(null)}
        >
          <RecordForm
            key={editing.student_id}
            fields={fields(false)}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (v) => {
              await api(`/admin/students/${editing.student_id}`, { method: "PUT", body: v });
              toast("Student saved.");
              list.reload();
            }}
          >
            <ConfirmButton
              label="Delete student"
              confirmLabel="Delete"
              question="Delete this student and their login?"
              onConfirm={async () => {
                try {
                  await api(`/admin/students/${editing.student_id}`, { method: "DELETE" });
                  toast("Student deleted.");
                  setEditing(null);
                  list.reload();
                } catch (err) {
                  toast(err.message, "bad");
                }
              }}
            />
          </RecordForm>

          <StudentRegistrations student={editing} />
        </Drawer>
      )}
    </div>
  );
}

// lets the admin register/drop a student manually (inside the student drawer)
function StudentRegistrations({ student }) {
  const toast = useToast();
  const { term, terms } = useTerm();

  // start on the selected term, or fall back if there isn't one yet
  const [termId, setTermId] = useState(
    term?.term_id || terms.find((t) => t.registration_open)?.term_id || terms.at(-1)?.term_id
  );

  const history = useLoad(
    () => api(`/admin/students/${student.student_id}/enrollments`),
    [student.student_id]
  );
  const sections = useLoad(() => api("/admin/sections", { query: { term_id: termId } }), [termId]);

  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function register(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/admin/enrollments", {
        method: "POST",
        body: { student_id: student.student_id, section_id: Number(sectionId) },
      });
      const s = sections.data.find((x) => x.section_id === Number(sectionId));
      toast(`Registered ${student.first_name} in ${s.course_code}, section ${s.section_number}.`);
      setSectionId("");
      history.reload();
      sections.reload();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function drop(r) {
    try {
      await api(`/admin/enrollments/${student.student_id}/${r.section_id}`, { method: "DELETE" });
      toast(`Dropped ${student.first_name} from ${r.course_code}.`);
      history.reload();
      sections.reload();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <section className="drawer-section">
      <h3 className="h2">Registration</h3>

      <form className="inline-form" onSubmit={register}>
        <Field label="Term">
          <select
            value={termId}
            onChange={(e) => {
              setTermId(e.target.value);
              setSectionId("");
            }}
          >
            {terms.map((t) => (
              <option key={t.term_id} value={t.term_id}>{t.term_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Section" wide>
          <select value={sectionId} required onChange={(e) => setSectionId(e.target.value)}>
            <option value="" disabled>Choose a section</option>
            {(sections.data || []).map((s) => (
              <option key={s.section_id} value={s.section_id}>
                {s.course_code} sec {s.section_number}, {scheduleLabel(s.schedule)} ({s.seats_left} left)
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-ink" disabled={busy || !sectionId}>
          {busy ? "Registering…" : "Register student"}
        </button>
      </form>

      <p className="field-hint">The add/drop deadline doesn't apply when you register a student. Other rules do.</p>
      {error && <p className="problem" role="alert">{error}</p>}

      <Problem error={history.error} />
      {history.data?.length === 0 && <p className="muted">No registrations yet.</p>}

      {history.data?.length > 0 && (
        <table className="table table-tight">
          <thead>
            <tr>
              <th>Term</th>
              <th>Course</th>
              <th>Status</th>
              <th>Grade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/* newest first */}
            {[...history.data].reverse().map((r) => (
              <tr key={r.enrollment_id} className={r.status === "Dropped" ? "is-dropped" : ""}>
                <td>{r.term_id}</td>
                <td><Code code={r.course_code} size="s" /> sec {r.section_number}</td>
                <td><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span></td>
                <td className="grade">{r.grade || ""}</td>
                <td>
                  {r.status === "Enrolled" && (
                    <ConfirmButton
                      label="Drop"
                      confirmLabel="Drop"
                      question="Sure?"
                      className="btn btn-line btn-small"
                      onConfirm={() => drop(r)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---- Instructors ----

export function AdminInstructors() {
  const toast = useToast();
  const list = useLoad(() => api("/admin/instructors"), []);
  const depts = useLoad(() => api("/departments"), []);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const fields = (isNew) => [
    ...(isNew ? [{ name: "instructor_id", label: "Instructor number", type: "number", required: true }] : []),
    { name: "first_name", label: "First name", required: true },
    { name: "last_name", label: "Last name", required: true },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      wide: true,
      hint: isNew ? "Their username will be the part before the @." : undefined,
    },
    { name: "office_location", label: "Office", hint: "For example, Lambton Tower 5105" },
    { name: "dept_id", label: "Department", type: "select", required: true, options: deptOptions(depts.data) },
    ...(isNew
      ? [{
          name: "password",
          label: "Starting password",
          type: "password",
          required: true,
          minLength: 8,
          hint: "At least 8 characters.",
        }]
      : []),
  ];

  // there aren't many instructors so we just filter on the client
  const s = search.trim().toLowerCase();
  const rows = (list.data || []).filter(
    (i) =>
      !s ||
      `${i.first_name} ${i.last_name}`.toLowerCase().includes(s) ||
      String(i.instructor_id).startsWith(s)
  );

  return (
    <div>
      <div className="head-row">
        <h1 className="h1">Instructors</h1>
        <input
          type="search"
          aria-label="Search instructors"
          placeholder="Search by name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-ink" onClick={() => setEditing("new")}>Add instructor</button>
      </div>

      <Problem error={list.error} onRetry={list.reload} />
      {list.loading && <Loading />}
      {list.data && rows.length === 0 && <Empty>No instructors match “{search}”.</Empty>}

      {rows.length > 0 && (
        <table className="table table-click">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Email</th>
              <th>Office</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr
                key={i.instructor_id}
                tabIndex={0}
                onClick={() => setEditing(i)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(i)}
              >
                <td className="id">{i.instructor_id}</td>
                <td><strong>{i.last_name}, {i.first_name}</strong></td>
                <td>{i.email}</td>
                <td>{i.office_location}</td>
                <td>{i.dept_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing === "new" && (
        <Drawer title="Add instructor" onClose={() => setEditing(null)}>
          <RecordForm
            fields={fields(true)}
            submitLabel="Add instructor"
            onSubmit={async (v) => {
              const r = await api("/admin/instructors", { method: "POST", body: v });
              toast(`Added ${v.first_name} ${v.last_name}. They log in as ${r.username}.`);
              setEditing(null);
              list.reload();
            }}
          />
        </Drawer>
      )}

      {editing && editing !== "new" && (
        <Drawer
          title={`${editing.first_name} ${editing.last_name}`}
          sub={`Instructor ${editing.instructor_id}`}
          onClose={() => setEditing(null)}
        >
          <RecordForm
            key={editing.instructor_id}
            fields={fields(false)}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={async (v) => {
              await api(`/admin/instructors/${editing.instructor_id}`, { method: "PUT", body: v });
              toast("Instructor saved.");
              list.reload();
            }}
          >
            <ConfirmButton
              label="Delete instructor"
              confirmLabel="Delete"
              question="Delete? Their sections will have no instructor."
              onConfirm={async () => {
                try {
                  await api(`/admin/instructors/${editing.instructor_id}`, { method: "DELETE" });
                  toast("Instructor deleted.");
                  setEditing(null);
                  list.reload();
                } catch (err) {
                  toast(err.message, "bad");
                }
              }}
            />
          </RecordForm>
        </Drawer>
      )}
    </div>
  );
}
