# Haq (हक़) — Build Spec for the 8-hour hackathon

**One line:** An AI caseworker for any Indian citizen with a civic problem. Describe it in your language (text, voice or photo); a Cline SDK agent works on your "case folder", finds the right authority and law, drafts a ready-to-file complaint and RTI application, checks its own work, and gives you a deadline timeline and appeal drafts.

**Problem:** Grievance and RTI systems exist (CPGRAMS, state RTI portals, municipal grievance cells), but most citizens don't know which office is responsible, what format to use, or what to do when nobody replies. Drafting and routing are the barrier, not the law.

---

## 1. What we build (in scope)

| # | Feature | Done when |
|---|---|---|
| F1 | **Intake** — text in English/Hindi/Assamese, voice via browser speech recognition, optional photo upload | A case is created with `facts.md` and `evidence/` |
| F2 | **Nested authority routing** — Central → State (Assam) → City (Guwahati) | `find_authority` returns the right level and office from `data/authorities.json`, or says "not covered" |
| F3 | **Law & portal lookup** — RTI Act, CPGRAMS, Assam RTI, GMC grievance | `lookup_law` returns rules + source URLs from `data/laws.json` |
| F4 | **Cline SDK caseworker agent** — plans, calls tools, writes drafts into the case folder | `plan.md`, `drafts/complaint.md`, `drafts/rti.md` written |
| F5 | **Self-check (validators as tests)** | `check_draft` passes for every draft; agent fixes and re-runs on failure |
| F6 | **Live agent view** | UI streams plan, each tool call, each file written, checks turning green |
| F7 | **Where & how to file** | Step-by-step filing guide with portal link, fee, address |
| F8 | **Deadline timeline** | `calc_deadlines` output shown as a timeline + `.ics` calendar download |
| F9 | **First appeal** | Button "No reply yet?" → agent drafts `drafts/first_appeal.md` |
| F10 | **Plain-language explanation** | Summary shown in the user's language; "read aloud" via browser speech synthesis |

**Stretch (only if time is left):** photo EXIF location/date as annexure; download drafts as PDF; second appeal.

**Out of scope (say "future scope" in PPT):** other states, auto-filing on portals, collective complaints map, WhatsApp bot, self-hosted Indian-language models.

## 2. Coverage (nested)

```
Central (any Indian citizen)
  ├─ CPGRAMS grievances (central ministries/departments, e.g. Posts, Railways, Passport, banks via DFS)
  └─ RTI to central public authorities (rtionline.gov.in)
State: Assam
  ├─ Assam RTI (rtionline.assam.gov.in) → First Appellate Authority → Assam Information Commission
  ├─ CM grievance (cm.assam.gov.in)
  └─ Departments: electricity (APDCL), ration (Food & Civil Supplies), roads outside city (PWD)
City: Guwahati (GMC)
  └─ Roads/potholes, streetlights, garbage, drainage, water supply → GMC Public Grievance Officer
```
Routing rule: pick the **most local** level that owns the issue. If the issue or place is not in the data, the agent must say so and give the general route (CPGRAMS / CM grievance / RTI to the most likely department) — never invent an office.

## 3. User flow (the demo scenario)

1. Citizen types or speaks in Assamese: *"Our lane in Guwahati has had a big pothole for 3 months, two people fell."* Uploads a photo.
2. Case page opens. Left: the agent working live (plan → `find_authority` → `lookup_law` → writing drafts → `check_draft` ✓✓✓). Right: tabs.
3. Tabs: **Summary** (in Assamese, read aloud) · **Complaint** (to GMC) · **RTI** (to GMC PIO: work orders, budget, inspection reports for that road) · **Where to file** · **Timeline**.
4. Citizen downloads drafts and `.ics`. 30 days later: "No reply yet?" → first appeal draft.

## 4. Architecture

```
Next.js app (TypeScript, App Router) — one repo, deployed on Vercel or run locally
 ├─ app/                      UI: intake page, case page (live view + tabs)
 ├─ app/api/cases/...         create case, SSE stream of agent events, read files, appeal
 ├─ lib/agent/runCase.ts      Cline SDK Agent: system prompt + custom tools, emits events
 ├─ lib/tools/                find_authority, lookup_law, calc_deadlines, check_draft,
 │                            read_case_file, write_case_file, finish_case
 ├─ data/                     authorities.json, laws.json (verified, with sources)
 ├─ prompts/caseworker.md     agent system prompt (versioned)
 └─ cases/<caseId>/           the case folder the agent works on
```

**Model:** Cline API (your Cline credits) through the SDK's `openai-compatible` provider, base URL `https://api.cline.bot/api/v1`, model `anthropic/claude-sonnet-4-6` for the agent. Free model `minimax/minimax-m2.5` for development/testing to save credits.

**No database:** each case is a folder; `cases/index.json` lists cases. This is the "repo" the agent works on.

## 5. Case folder layout

```
cases/<caseId>/
  facts.md              intake text, language, location, date problem started
  evidence/photo-1.jpg
  plan.md               agent's plan (written first)
  routing.json          output of find_authority
  drafts/complaint.md
  drafts/rti.md
  drafts/first_appeal.md   (only after "No reply yet?")
  checks.json           latest check_draft results per draft
  timeline.json         output of calc_deadlines
  summary.<lang>.md     plain-language explanation
  filing_guide.md       where and how to file
```

## 6. Safety rules (product)

- Never invent an authority, law section, fee or deadline. Only use `data/*.json`; if missing, say "not covered — verify".
- Never auto-file or pay. The citizen files.
- Show "Not legal advice. For complex cases contact your District Legal Services Authority (free legal aid)."
- Minimise personal data: drafts use `[Your name]`, `[Your address]` placeholders that the user fills in the browser; nothing personal is sent to the model unless typed.
- File tools are scoped to the case folder; no shell, no network from the agent.

## 7. Judging checklist

- Creativity/innovation: agent works on a case folder like a repo; validators as tests; nested routing.
- Real-world usefulness: real portals, real fees, real deadlines, sources linked.
- Effective use of Cline: built with Cline (Plan/Act, rules, Memory Bank, checkpoints) **and** Cline SDK inside the product (bonus).
- Usability: 3-step flow, local language, read aloud, calendar download.
- Technical: custom tools, event streaming, deterministic validators, tests.
