import { createEvents, type EventAttributes } from "ics";
import { getLaw, getLawRules, lawNumber, type LawEntry } from "./data";

export type DeadlineKind = "grievance" | "rti" | "appeal";

export interface DeadlineEvent {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  kind: DeadlineKind;
  explanation: string;
}

export interface DeadlineRoute {
  grievanceKey?: string | null;
  rtiKey?: string | null;
}

export interface DeadlineOptions {
  /** YYYY-MM-DD. If the first appeal was really filed on this date, FAA and second-appeal dates are computed from it. */
  firstAppealDate?: string | null;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const RTI_ACT_KEY = "rti_act_2005";

function parseDate(value: string, name: string): number {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`${name} must be a valid date in YYYY-MM-DD format, got "${value}".`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`${name} must be a valid date in YYYY-MM-DD format, got "${value}".`);
  }
  return time;
}

function formatDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function addDays(time: number, days: number): number {
  return time + days * DAY_MS;
}

function dayNumber(day0: number, time: number): number {
  return Math.round((time - day0) / DAY_MS);
}

/** Day counts are measured from the RTI filing date, which is day 0. */
export function calcDeadlines(
  route: DeadlineRoute,
  filingDate: string,
  options: DeadlineOptions = {},
): DeadlineEvent[] {
  const day0 = parseDate(filingDate, "filingDate");
  const firstAppeal =
    options.firstAppealDate != null && options.firstAppealDate !== ""
      ? parseDate(options.firstAppealDate, "firstAppealDate")
      : undefined;
  if (firstAppeal !== undefined && firstAppeal < day0) {
    throw new Error("firstAppealDate cannot be before filingDate.");
  }

  const events: DeadlineEvent[] = [];
  addGrievanceEvents(events, getLaw(route.grievanceKey), day0, filingDate);
  addRtiEvents(events, route.rtiKey, day0, filingDate, firstAppeal);

  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.date.localeCompare(b.event.date) || a.index - b.index)
    .map(({ event }) => event);
}

function addGrievanceEvents(
  events: DeadlineEvent[],
  law: LawEntry | undefined,
  day0: number,
  filingDate: string,
): void {
  if (!law) return;
  const name = typeof law.name === "string" ? law.name : "The grievance portal";
  const ackDays = lawNumber(law, "acknowledgement_days");
  const redressalDays = lawNumber(law, "redressal_days");
  const assumption = `Counted from ${filingDate} (day 0), assuming the grievance is filed on the same day as the RTI.`;

  if (ackDays !== undefined) {
    events.push({
      date: formatDate(addDays(day0, ackDays)),
      label: "Grievance acknowledgement due",
      kind: "grievance",
      explanation: `${name}: an acknowledgement is expected within ${ackDays} days of filing. ${assumption}`,
    });
  }

  if (redressalDays !== undefined) {
    const appealDays = lawNumber(law, "appeal_window_days");
    const appealNote =
      appealDays !== undefined
        ? ` If the grievance is closed unsatisfactorily, you can rate it Poor and appeal within ${appealDays} days.`
        : "";
    events.push({
      date: formatDate(addDays(day0, redressalDays)),
      label: "Grievance redressal due",
      kind: "grievance",
      explanation: `${name}: the grievance should be resolved within ${redressalDays} days of filing. ${assumption}${appealNote}`,
    });
  }
}

function addRtiEvents(
  events: DeadlineEvent[],
  rtiKey: string | null | undefined,
  day0: number,
  filingDate: string,
  firstAppeal: number | undefined,
): void {
  // Only offices whose RTI rules are in laws.json get RTI events.
  if (!getLaw(rtiKey)) return;
  const act = getLawRules(getLaw(RTI_ACT_KEY));
  const replyDays = lawNumber(act, "reply_deadline_days");
  if (replyDays === undefined) return;

  const windowDays = lawNumber(act, "first_appeal_window_days");
  const decisionDays = lawNumber(act, "first_appeal_decision_days");
  const maxDecisionDays = lawNumber(act, "first_appeal_decision_max_days");
  const secondWindowDays = lawNumber(act, "second_appeal_window_days");

  const replyDue = addDays(day0, replyDays);
  const base = `Counted from the RTI filing date ${filingDate} (day 0).`;

  events.push({
    date: formatDate(replyDue),
    label: "RTI reply due",
    kind: "rti",
    explanation: `The PIO must reply within ${replyDays} days of filing (day ${replyDays}). ${base}`,
  });

  if (windowDays === undefined) return;
  const windowEnd = addDays(replyDue, windowDays);
  const assumed = firstAppeal === undefined;
  const appealDate = firstAppeal ?? replyDue;
  const appealDay = dayNumber(day0, appealDate);
  const appealAssumption = assumed
    ? `Assumption: the first appeal is filed on day ${replyDays}, the day the reply is due.`
    : `The first appeal is taken as filed on ${formatDate(appealDate)} (day ${appealDay}).`;

  const lateNote =
    appealDate > windowEnd
      ? ` Note: the first appeal date is after the window ended on ${formatDate(windowEnd)}.`
      : "";
  events.push({
    date: formatDate(windowEnd),
    label: "Last day to file first appeal",
    kind: "appeal",
    explanation: `The first appeal to the First Appellate Authority must be filed within ${windowDays} days of the reply or of the reply deadline expiring, so by day ${dayNumber(day0, windowEnd)}. ${base} Assuming no reply, the window runs from day ${replyDays}.${lateNote}`,
  });

  if (decisionDays === undefined) return;
  const faaDue = addDays(appealDate, decisionDays);
  const maxNote =
    maxDecisionDays !== undefined
      ? ` The maximum time for the decision is ${maxDecisionDays} days (${formatDate(addDays(appealDate, maxDecisionDays))}, day ${appealDay + maxDecisionDays}).`
      : "";
  events.push({
    date: formatDate(faaDue),
    label: "First appeal decision due",
    kind: "appeal",
    explanation: `The First Appellate Authority should decide within ${decisionDays} days of the first appeal (day ${dayNumber(day0, faaDue)}). ${base} ${appealAssumption}${maxNote}`,
  });

  if (secondWindowDays === undefined) return;
  const secondEnd = addDays(faaDue, secondWindowDays);
  events.push({
    date: formatDate(secondEnd),
    label: "Last day to file second appeal",
    kind: "appeal",
    explanation: `The second appeal to the Information Commission must be filed within ${secondWindowDays} days of the first appeal decision or of the date it was due (day ${dayNumber(day0, secondEnd)}). ${base} ${appealAssumption} The window is counted from the first appeal decision due date, ${formatDate(faaDue)}.`,
  });
}

/** Builds an .ics calendar of all-day events. Throws if the calendar cannot be generated. */
export function toIcs(events: DeadlineEvent[]): string {
  const attributes: EventAttributes[] = events.map((event, index) => {
    const start = parseDate(event.date, "event date");
    const s = new Date(start);
    const e = new Date(addDays(start, 1));
    return {
      start: [s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate()],
      end: [e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate()],
      title: event.label,
      description: event.explanation,
      categories: [event.kind],
      uid: `haq-${event.date}-${event.kind}-${index}@haq`,
    };
  });
  const { error, value } = createEvents(attributes, { calName: "Haq deadlines" });
  if (error || !value) throw new Error(`Could not build calendar: ${String(error)}`);
  return value;
}
