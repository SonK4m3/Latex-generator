# Surface Brief: Landing Page (new `/`)

## Scope & Mode
New marketing/landing surface, replacing the current `/` (the generator tool moves to `/app`). Mode: **Persuade** — visitor decides and acts; design is the product here, distinct from the Operate world ("The Compile Room") documented in root DESIGN.md, which governs the tool itself, not this surface.

## Audience, Job, Action
- Audience: Vietnamese students/researchers (primary) and secondary academic/technical writers, arriving with deadline pressure and LaTeX-syntax frustration.
- Job: decide, in seconds, "does this actually produce a real, working document, or is it another AI-text-generator that outputs broken LaTeX?"
- Action: start a document (primary CTA → `/app`).

## Proof / Content Constraints
No real customers, testimonials, benchmarks, or pricing exist (confirmed in PRODUCT.md's Evidence on Hand). Proof must come from demonstrating the mechanism itself (natural language → real compile → self-heal), not social proof. Any illustrative document/screen content is authored, synthetic, and must read as clearly illustrative rather than a fabricated customer artifact.

## Chosen Direction (recorded 2026-07-28)
Seed key `0dcb7a30` (`concept-seed.mjs --scope direction --mode persuade`), assigned index 7 of 7 grounded candidates, fused with the "Reduction Passes" staging challenger.

- **THESIS**: A generated document isn't just text — it's a real, finished, bound thing, the way a thesis viva copy is real. Refuses the generic "chat bubble → magic AI output" SaaS arrangement.
- **OWN-WORLD**: The Thesis Binding & Title Page. Cloth-spine navy/charcoal ground, deckle-edge cream paper panels, gold-foil serif display type (small caps, wide tracking) for headlines, wax-seal red as the single committed accent (CTAs, compile-status), a university-seal medallion motif reused as a compile-status badge.
- **STORY**: Visitor understands this turns rough notes into an actual finished academic document, safely, and fixes itself when it breaks — believes it because binding stations *show* the repair loop happening, not just claim it — acts by starting a document.
- **FIRST VIEWPORT**: Full-bleed cloth-spine texture background; center-left a large gold-foil-stamped title card mid-assembly (draft pages visibly stacking/binding through fold → stitch → stamp → seal stations, dramatizing the self-healing repair loop); center-right the primary CTA styled as a stamped wax seal; page title set in tracked gold-foil caps at top.
- **FORM**: Binding-station sequence (fold/stitch/stamp/seal) replaces a generic progress bar or step-list — this is the fused staging device, applied to the hero and reused for a "how it works" section further down the page.

## Color Strategy
Committed (per new-work.md Step 4): cloth navy/charcoal ground carries the large majority of the surface; wax-seal red is the single accent, rationed to CTAs and "sealed/complete" status only — never decorative.

## Relationship to Root DESIGN.md
This world is scoped to the landing surface only. It does not replace or amend root `DESIGN.md` (The Compile Room / Operate world), which continues to govern `/app` and all authenticated tool screens. Do not carry cloth/gold-foil/wax-seal into the tool itself; do not carry Compile Blue/grayscale into this landing page. The two worlds meet only at the CTA hand-off point (landing → `/app`).

## Detector Note
`node .kiro/skills/impeccable/scripts/detect.mjs` will flag every color/font/radius in `app/landing.css` as "outside DESIGN.md" — this is expected, not drift. Root `DESIGN.md` documents only The Compile Room (Operate) world; this file is where the Thesis Binding (Persuade) world's tokens are recorded instead. Do not resolve these findings by conforming the landing page to the tool's grayscale tokens.

## Unresolved / Open
- Exact typeface choice for gold-foil display (candidate: a serif with real small-caps support — to be selected during build, avoiding trained-default picks per new-work.md's calibration guidance).
- Whether a real screenshot of the tool's actual UI (Compile Room world) appears anywhere on the landing page as "proof" — recommend yes, in a clearly-framed "inside the binding" reveal panel near the bottom, so the two worlds are shown as a considered before/after rather than clashing.
- No image-generation tool confirmed available in this environment; hero visuals will be built with CSS/SVG-authored texture and iconography rather than generated photography, and this is disclosed as a fidelity constraint, not a skipped step.
