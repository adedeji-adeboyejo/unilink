export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export const DAY_NAMES = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
};

// "11:30" or "11:30:00" -> 690 (minutes since midnight)
export const toMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

// 690 -> "11:30"
export const fmt = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

// the search endpoint gives schedules as a string like
// "Tue 11:30-12:50, Thu 11:30-12:50"
export function parseSchedule(s) {
  if (!s) return [];

  return s.split(",").map((part) => {
    const [day, range] = part.trim().split(" ");
    const [a, b] = range.split("-");
    return { day, start: toMin(a), end: toMin(b) };
  });
}

// turns the schedule into something readable, e.g. "Tue, Thu 11:30–12:50"
// (days only get merged if the times are the same)
export function scheduleLabel(s) {
  const ms = parseSchedule(s);
  if (!ms.length) return "No meeting times yet";

  const groups = [];
  for (const m of ms) {
    const g = groups.find((x) => x.start === m.start && x.end === m.end);
    if (g) {
      g.days.push(m.day);
    } else {
      groups.push({ ...m, days: [m.day] });
    }
  }

  return groups.map((g) => `${g.days.join(", ")} ${fmt(g.start)}–${fmt(g.end)}`).join("; ");
}

export const overlaps = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;
