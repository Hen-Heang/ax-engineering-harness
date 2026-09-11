# Repository history

Before AX Engineering Harness this repository was conceptually `dev-lab`.
The original root README is preserved below; local paths are historical.

---

# dev-lab

My personal lab for practice projects and learning. Each folder is an independent project.

| Project | Description | Stack |
|---------|-------------|-------|
| [heang-api-center](heang-api-center/) | API practice project | Spring Boot, Maven |
| [heang-dev-lab](heang-dev-lab/) | Store admin system (Korean enterprise stack) | Spring Boot, MyBatis, PostgreSQL, Thymeleaf, Maven |
| [spring-boot-lab](spring-boot-lab/) | Spring Boot learning path, organized by topic (web, data, security, messaging, testing, cloud, AI) | Spring Boot |
| [AuthHub](AuthHub/) | Authentication hub — multi-module project (common-api, security-api, todoapi); legacy JWT practice lives under `AuthHub/legacy/spring-jwt-auth` | Spring Boot, Gradle |

## Moved out

These used to live here but were extracted into their own standalone repos (each with full history preserved) because bundling everything into one IntelliJ project made per-project source roots/SDKs impossible to configure correctly:

- `java-core-mastery-lab` → `E:\API\java-core-mastery-lab`
- `dev-learning-notes & AI` → `E:\API\dev-learning-notes & AI`

## Known issue

`spring-boot-lab/AuthHub` is a stale duplicate of the root `AuthHub` that has diverged with unique, unmerged work (OAuth2/OTP auth flow) not present in the root copy (which has its own unique MFA/audit work instead). Neither has been deleted — needs a manual merge decision before cleanup.

## Notes

- Each Spring project has its own Maven wrapper — run with `mvnw.cmd spring-boot:run` (Windows) from inside the project folder.
- Open each project separately in IntelliJ for correct Maven/Gradle detection.
- Combined from four separate repositories in June 2026; older commit history lives in the archived original repos.
