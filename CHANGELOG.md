# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Monorepo structural setup and configured root `package.json`.
- Configured PostgreSQL Prisma database schema with enums, composite indexes, soft deletes, and dynamic status engine configurations.
- Added database seeding module with core protected statuses (`BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) and default credentials.
- Implemented robust security layer with JWT token rotation (RTR) to intercept session hijacking attempts and revoke compromised session paths.
- Enforced project-level authentication context queries in the backend service layer (`AuthorizationService`).
- Created Projects CRUD endpoints and project member assignments (restricted to Administrators).
- Created Tasks CRUD endpoints featuring atomic key number generation (e.g. `MOB-1`, `MOB-2`) and soft delete filtering.
- Implemented 18 comprehensive Express endpoints integration tests using Vitest and Supertest.
