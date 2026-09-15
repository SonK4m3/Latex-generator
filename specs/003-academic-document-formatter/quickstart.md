# Validation Quickstart

## Preconditions
- Authenticated test user; supported template fixture; compile service available for PDF checks.
- Use representative user-owned report, thesis, paper, and assignment fixtures. Never use generated prose as preservation evidence.

## Validation scenarios
1. **Clear report:** submit explicit headings, table, figure caption; verify direct rendering, block provenance, compile success, and deterministic repeated source.
2. **Ambiguous input:** submit plain text with competing hierarchy/caption interpretation; verify no rendering before review, approve a classification change, and confirm source text remains unchanged.
3. **Missing requirements:** omit required template metadata/sections; verify Draft state, stable rule IDs/messages, and permitted draft export.
4. **Ready submission:** submit complete template fixture; verify every mandatory rule passes, compilation succeeds, and state is Ready to submit.
5. **Compile failure:** use a renderer fixture that fails compilation; verify Draft status, source/log availability, and no content-changing retry.
6. **Ownership:** access each formatter resource as another user; verify it is unavailable.
7. **Unverified institution format:** submit a sample/rules request; verify received/unverified state and no compliance claim.

## Quality gates
Run focused unit and integration suites, then full lint, test, and build. Run compile-service contract tests when Tectonic is available. Verify no formatter path invokes an AI provider or content-changing repair loop.
