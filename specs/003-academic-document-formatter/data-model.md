# Data Model

## SourceSnapshot
Immutable supplied content: `id`, `ownerId`, source name/type, exact text, content hash, received time.

## SemanticDocument
Approved structure: `id`, owner, source snapshot IDs, selected `AcademicTemplate` and version, metadata blocks, ordered semantic blocks, review status, timestamps.

## SemanticBlock
One renderable or missing element: `id`, kind (title, heading, paragraph, list, table, figure, caption, equation, reference-placeholder, missing), hierarchy position, source provenance, status.

## BlockProvenance
Links each block to exact snapshot/source offsets and hash. Text is immutable after normalization; review changes classification/order/hierarchy only.

## SemanticReview
Pending/approved review of ambiguity items. Patch operations may relabel, nest, reorder, split, merge, or mark missing; they cannot replace source text.

## AcademicTemplate
Product-owned versioned definition: template identity, renderer identity, required metadata/sections, mandatory and warning compliance rules, allowed presentation contract.

## ComplianceResult
Template/version, check run time, rule results (ID, severity, message, affected blocks, remediation), and derived submission state.

## SubmissionState
`needs_semantic_review`, `draft`, or `ready_to_submit`. Ready requires approved review, mandatory compliance pass, source validation pass, and compile success.

## FormatRequest
Owner-scoped unverified request for an institution format: written rules and/or sample reference, received status, and explicit no-compliance-claim marker.
