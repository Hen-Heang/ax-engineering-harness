# Repository audit — 2026-09-11

Baseline commit: `541112b`. Existing origin is
`https://github.com/Hen-Heang/ax-engineering-harness.git`. Working tree was clean.
Architecture inspection covered the tracked inventory, manifests, source layout,
project instructions, documentation, and test/configuration patterns. It was not
a line-by-line code review, secret audit, or verification of legacy builds.

- 1,257 tracked files; 54 Maven manifests; three Gradle build roots.
- Root AuthHub: Java 17, Spring Boot 3.5.15, common-api/security-api/todoapi modules.
- Nested AuthHub: divergent copy, preserved; root README records unique work.
- AuthHub/legacy/spring-jwt-auth: independent archived Gradle project.
- heang-api-center: Maven, Java 17, Spring Boot 4.0.3, WebFlux/API practice.
- heang-dev-lab: Maven, Java 21, Spring Boot 4.0.3, MyBatis 4.0.1, admin features.
- spring-boot-lab: independent examples and aggregators, Java 11/17, Boot 2.x/3.x.
- Existing CLAUDE.md files belong to AuthHub and heang-dev-lab.
- No initial Node workspace, Harness, website, root AGENTS.md, root license, or CI.

## Preservation and risks

All existing Java project trees, wrappers, SQL, resources, instructions, notes,
tests, and IDE configuration remain intact. No project move is necessary.

Documentation/build-version drift exists, particularly in heang-dev-lab.
Credential-related settings exist in legacy files; do not publish them through
the future catalog. Some tests require real databases. Paths contain spaces and
`#`. Global builds would conflate unrelated projects and external dependencies.

Licensing for public reuse remains unresolved. A license must not be chosen
implicitly for inherited code. AuthHub consolidation is a separate explicit
user decision. Supplied reference websites/Notion pages were unavailable during
the audit; the architecture follows the written brief.
