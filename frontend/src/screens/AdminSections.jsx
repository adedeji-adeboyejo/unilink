import { useState } from "react";
import { api } from "../api.js";
import { useTerm } from "../App.jsx";
import { DAYS, DAY_NAMES, scheduleLabel } from "../time.js";
import { Code, ConfirmButton, Drawer, Empty, Field, Loading, Problem, SeatMeter, useLoad, useToast } from "../ui.jsx";

export default function AdminSections() {
  const { term } = useTerm();
  const list = useLoad(() => api("/admin/sections", { query: { term_id: term.term_id } }), [term.term_id]);
  const instructors = useLoad(() => api("/instructors"), []);
  const rooms = useLoad(() => api("/rooms"), []);
  const courses = useLoad(() => api("/courses"), []);
  const [editing, setEditing] = useState(null);

  // dropdown data for the add/edit forms
  const lookups = {
    instructors: instructors.data || [],
    rooms: rooms.data || [],
    courses: courses.data || [],
  };

  return (
    <div>
      <div className="head-row">
        <h1 className="h1">Sections in {term.term_name}</h1>
        <button className="btn btn-ink" onClick={() => setEditing("new")}>Add section</button>
      </div>

      <Problem error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Loading />}
      {list.data?.length === 0 && (
        <Empty>No sections are scheduled for {term.term_name}. Add one to open registration for a course.</Empty>
      )}

      {list.data?.length > 0 && (
        <table className="table table-click">
          <thead>
            <tr>
              <th>Course</th>
              <th>Section</th>
              <th>Meets</th>
              <th>Instructor</th>
              <th>Seats</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((s) => (
              <tr
                key={s.section_id}
                tabIndex={0}
                onClick={() => setEditing(s)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(s)}
              >
                <td>
                  <Code code={s.course_code} size="s" /> <span className="muted cell-sub">{s.title}</span>
                </td>
                <td className="num">{s.section_number}</td>
                <td>{scheduleLabel(s.schedule)}</td>
                <td>{s.instructor}</td>
                <td className="cell-meter">
                  <SeatMeter enrolled={s.enrolled} limit={s.enrollment_limit} compact />
                </td>
                <td><span className={`status status-${s.status.toLowerCase()}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing === "new" && (
        <Drawer title="Add section" sub={term.term_name} onClose={() => setEditing(null)}>
          <NewSection
            termId={term.term_id}
            lookups={lookups}
            existing={list.data || []}
            onDone={() => {
              setEditing(null);
              list.reload();
            }}
          />
        </Drawer>
      )}

      {editing && editing !== "new" && (
        <Drawer
          title={`${editing.course_code}, section ${editing.section_number}`}
          sub={editing.title}
          onClose={() => setEditing(null)}
        >
          <EditSection
            section={editing}
            lookups={lookups}
            onChange={list.reload}
            onDeleted={() => {
              setEditing(null);
              list.reload();
            }}
          />
        </Drawer>
      )}
    </div>
  );
}

const blankMeeting = () => ({ day_of_week: "Mon", start_time: "10:00", end_time: "11:20", room_id: "" });

// day / start / end / room inputs for one weekly meeting
function MeetingFields({ m, rooms, onChange }) {
  return (
    <>
      <Field label="Day">
        <select value={m.day_of_week} onChange={(e) => onChange({ ...m, day_of_week: e.target.value })}>
          {DAYS.map((d) => (
            <option key={d} value={d}>{DAY_NAMES[d]}</option>
          ))}
        </select>
      </Field>
      <Field label="Starts">
        <input
          type="time"
          value={m.start_time}
          required
          onChange={(e) => onChange({ ...m, start_time: e.target.value })}
        />
      </Field>
      <Field label="Ends">
        <input
          type="time"
          value={m.end_time}
          required
          onChange={(e) => onChange({ ...m, end_time: e.target.value })}
        />
      </Field>
      <Field label="Room">
        <select value={m.room_id} required onChange={(e) => onChange({ ...m, room_id: e.target.value })}>
          <option value="" disabled>Choose a room</option>
          {rooms.map((r) => (
            <option key={r.room_id} value={r.room_id}>{r.room} ({r.capacity} seats)</option>
          ))}
        </select>
      </Field>
    </>
  );
}

function NewSection({ termId, lookups, existing, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ course_code: "", section_number: "", instructor_id: "", enrollment_limit: 40 });
  const [meetings, setMeetings] = useState([blankMeeting()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // when a course is picked, suggest the next free section number
  const pickCourse = (code) => {
    const used = existing.filter((s) => s.course_code === code).map((s) => s.section_number);
    setV({ ...v, course_code: code, section_number: used.length ? Math.max(...used) + 1 : 1 });
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await api("/admin/sections", {
        method: "POST",
        body: {
          course_code: v.course_code,
          term_id: termId,
          section_number: Number(v.section_number),
          instructor_id: v.instructor_id ? Number(v.instructor_id) : null,
          enrollment_limit: Number(v.enrollment_limit),
          meetings: meetings.map((m) => ({ ...m, room_id: Number(m.room_id) })),
        },
      });
      toast(`Added ${v.course_code}, section ${v.section_number}.`);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Course" wide>
          <select value={v.course_code} required onChange={(e) => pickCourse(e.target.value)}>
            <option value="" disabled>Choose a course</option>
            {lookups.courses.map((c) => (
              <option key={c.course_code} value={c.course_code}>{c.course_code} {c.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Section number">
          <input
            type="number"
            min={1}
            required
            value={v.section_number}
            onChange={(e) => setV({ ...v, section_number: e.target.value })}
          />
        </Field>
        <Field label="Seats">
          <input
            type="number"
            min={1}
            required
            value={v.enrollment_limit}
            onChange={(e) => setV({ ...v, enrollment_limit: e.target.value })}
          />
        </Field>
        <Field label="Instructor" wide>
          <select value={v.instructor_id} onChange={(e) => setV({ ...v, instructor_id: e.target.value })}>
            <option value="">To be announced</option>
            {lookups.instructors.map((i) => (
              <option key={i.instructor_id} value={i.instructor_id}>{i.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <h3 className="h3">Weekly meetings</h3>
      {meetings.map((m, i) => (
        <div key={i} className="meeting-row">
          <MeetingFields
            m={m}
            rooms={lookups.rooms}
            onChange={(nm) => setMeetings(meetings.map((x, j) => (j === i ? nm : x)))}
          />
          {meetings.length > 1 && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setMeetings(meetings.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-line" onClick={() => setMeetings([...meetings, blankMeeting()])}>
        Add another meeting
      </button>
      <p className="field-hint">The section and its meetings are saved together. If a room or instructor is double-booked, nothing is saved.</p>

      {error && <p className="problem" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-ink" disabled={busy}>{busy ? "Adding…" : "Add section"}</button>
      </div>
    </form>
  );
}

function EditSection({ section, lookups, onChange, onDeleted }) {
  const toast = useToast();
  const details = useLoad(() => api(`/sections/${section.section_id}`), [section.section_id]);
  const [v, setV] = useState({
    instructor_id: section.instructor_id ?? "",
    enrollment_limit: section.enrollment_limit,
    status: section.status,
  });
  const [meeting, setMeeting] = useState(blankMeeting());
  const [error, setError] = useState("");
  const [mError, setMError] = useState(""); // separate error for the add-meeting form

  async function save(e) {
    e.preventDefault();
    setError("");

    try {
      await api(`/admin/sections/${section.section_id}`, {
        method: "PUT",
        body: {
          instructor_id: v.instructor_id ? Number(v.instructor_id) : null,
          enrollment_limit: Number(v.enrollment_limit),
          status: v.status,
        },
      });
      toast("Section saved.");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addMeeting(e) {
    e.preventDefault();
    setMError("");

    try {
      await api(`/admin/sections/${section.section_id}/meetings`, {
        method: "POST",
        body: { ...meeting, room_id: Number(meeting.room_id) },
      });
      toast("Meeting added.");
      setMeeting(blankMeeting());
      details.reload();
      onChange();
    } catch (err) {
      setMError(err.message);
    }
  }

  async function removeMeeting(id) {
    try {
      await api(`/admin/meetings/${id}`, { method: "DELETE" });
      toast("Meeting removed.");
      details.reload();
      onChange();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  return (
    <>
      <SeatMeter enrolled={section.enrolled} limit={section.enrollment_limit} />

      <form className="form" onSubmit={save}>
        <div className="form-grid">
          <Field label="Instructor" wide>
            <select value={v.instructor_id} onChange={(e) => setV({ ...v, instructor_id: e.target.value })}>
              <option value="">To be announced</option>
              {lookups.instructors.map((i) => (
                <option key={i.instructor_id} value={i.instructor_id}>{i.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Seats" hint={`${section.enrolled} students are registered.`}>
            <input
              type="number"
              min={1}
              required
              value={v.enrollment_limit}
              onChange={(e) => setV({ ...v, enrollment_limit: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
              <option>Open</option>
              <option>Full</option>
              <option>Closed</option>
            </select>
          </Field>
        </div>

        {error && <p className="problem" role="alert">{error}</p>}

        <div className="form-actions">
          <button className="btn btn-ink">Save changes</button>
          <ConfirmButton
            label="Delete section"
            confirmLabel="Delete"
            question="Delete this section?"
            onConfirm={async () => {
              try {
                await api(`/admin/sections/${section.section_id}`, { method: "DELETE" });
                toast("Section deleted.");
                onDeleted();
              } catch (err) {
                toast(err.message, "bad");
              }
            }}
          />
        </div>
      </form>

      <section className="drawer-section">
        <h3 className="h2">Weekly meetings</h3>
        <Problem error={details.error} />
        {details.loading && <Loading />}
        {details.data?.meetings.length === 0 && (
          <p className="muted">This section has no meeting times yet.</p>
        )}

        <ul className="rows">
          {(details.data?.meetings || []).map((m) => (
            <li key={m.meeting_id}>
              <span>
                {DAY_NAMES[m.day_of_week]} {m.start_time.slice(0, 5)}–{m.end_time.slice(0, 5)}, {m.room}
              </span>
              <button className="btn btn-line btn-small" onClick={() => removeMeeting(m.meeting_id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        <form className="meeting-row" onSubmit={addMeeting}>
          <MeetingFields m={meeting} rooms={lookups.rooms} onChange={setMeeting} />
          <button className="btn btn-ink">Add meeting</button>
        </form>
        {mError && <p className="problem" role="alert">{mError}</p>}
      </section>
    </>
  );
}
