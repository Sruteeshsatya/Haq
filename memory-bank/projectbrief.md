# Project brief: Haq (हक़, "your right")

Haq is an AI caseworker for Indian citizens with civic problems (potholes, streetlights, garbage, water, electricity, ration cards, post office, railways, passports).

The citizen describes the problem in English, Hindi or Assamese (text, voice or photo). A Cline SDK agent works on a per-case folder like a repo: it plans, calls custom tools to find the responsible authority (nested: Guwahati city -> Assam state -> Central government) and the applicable law/portal, writes a complaint and an RTI application, runs deterministic checks on its drafts and fixes them, and produces a deadline timeline and a filing guide. When the department doesn't reply, it drafts the first appeal.

Built for the Cline AI Builder Hackathon (Round 2, 8 hours). Judged on creativity, innovation, real-world usefulness, effective use of Cline, usability and technical implementation. Bonus for Cline inside the product.

Full spec: `docs/SPEC.md`. Rules: `.clinerules/01-haq.md`. Build steps: `docs/CLINE_PROMPTS.md`.
