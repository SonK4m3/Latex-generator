# Formatter API Contract

## Create formatter document
`POST /api/academic-formatters`

Input: selected academic template, pasted content and/or extracted source references, optional presentation metadata.

Outcomes: invalid input; `needs_semantic_review` with review items; or persisted Draft/Ready formatter artifact.

## Submit semantic review
`PUT /api/academic-formatters/{id}/semantic-review`

Input: classification/order/hierarchy patch against original block IDs.

Guarantee: source content and provenance are immutable. On approval, the service renders, validates, checks compliance, and compiles.

## Retrieve and compliance
`GET /api/academic-formatters/{id}` returns semantic status, compliance, compile state, and available artifacts. `POST /api/academic-formatters/{id}/compliance` reruns deterministic checks without content mutation.

## Export
`GET /api/academic-formatters/{id}/export?kind=source|pdf` includes Draft/Ready state and failed mandatory checks. Source is available after rendering; PDF only exists after successful compilation.

## Format request
`POST /api/format-requests` accepts a written requirement and/or sample reference. Response explicitly reports it as unverified; it creates no institutional-compliance claim.

All document, review, export, and format-request operations are owner-scoped.
