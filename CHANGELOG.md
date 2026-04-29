# Changelog

## [1.5.0](https://github.com/localstack/localstack-toolkit-vscode/compare/v1.4.2...v1.5.0) (2026-04-29)


### Features

* integrate appinspector UI ([#72](https://github.com/localstack/localstack-toolkit-vscode/issues/72)) ([d1b39f2](https://github.com/localstack/localstack-toolkit-vscode/commit/d1b39f260dfe6d398baecaf1a4c40bce8763e4d5))

## [1.4.2](https://github.com/localstack/localstack-toolkit-vscode/compare/v1.4.1...v1.4.2) (2026-03-31)


### Bug Fixes

* release workflow publishing ([#109](https://github.com/localstack/localstack-toolkit-vscode/issues/109)) ([370d6c0](https://github.com/localstack/localstack-toolkit-vscode/commit/370d6c073020d6ecfe8c01f50f42f322b4d61bcd))

## [1.4.1](https://github.com/localstack/localstack-toolkit-vscode/compare/v1.4.0...v1.4.1) (2026-03-31)

- chore: use release-please (#106)

## 1.3.0 (2026-02-11)

- fix: localstack installation on ubuntu/i3 (#77)
- feat: support more vscode-flavored editors (#81)

## 1.2.8 (2025-11-19)

- chore: Bump glob to tackle CVE

## 1.2.7 (2025-11-11)

- fix: Handle license check accordingly

## 1.2.6 (2025-11-06)

- chore: Publishing from Github action

## 1.2.5 (2025-11-05) (pre-release)

- chore: Testing publishing from Github action

## 1.2.4 (2025-10-13)

- chore: Update dependencies

## 1.2.3 (2025-09-12)

- fix: Show LocalStack Setup Wizard pop-up only when setup is required

## 1.2.2 (2025-09-11)

- chore: Update repository URL
- chore: Add AWS Toolkit integration information

## 1.2.1 (2025-09-10)

- fix: Add proactive DNS resolution check in AWS config check to timely detect configuration drift
- fix: Add a missing telemetry field in `setup_ended` event
- chore: Substitute periodic checks with file watchers for LocalStack setup status.


## 1.2.0 (2025-09-09)

- feat: Always show `Start` and `Stop` commands if LocalStack CLI is available
- feat: Always display LocalStack instance status if LocalStack CLI is available
- feat: Use modals to improve the clarity of installation and authentication setup steps
- feat: Pre-fetch LocalStack docker image during setup wizard
- fix: Reduce LocalStack health check calls to a necessary minimum
- fix: Improve LocalStack endpoint detection in AWS profile config process
- fix: Invalid status when stopping LocalStack externally
- fix: Don't show start localstack if already started during setup
- chore: Improve logging DNS resolution failure
- chore: Update telemetry events
- chore: Remove preview badge

## 1.1.0 (2025-09-04)

- feat: Add LocalStack license activation step to the setup wizard
- fix: Add various correctness and speed improvements to LocalStack status tracker reporting
- fix: Prevent starting LocalStack if it is already running or stopping when it is not running
- chore: Add profiling traces to the output channel for the startup times of the extension and its plugins

## 1.0.2 (2025-09-02)

- fix: LocalStack status tracker reporting affected by Lambda function invocation

## 1.0.1 (2025-09-01)

- fix: Fix browser redirect in Localstack authentication
- fix: Update Extension Marketplace assets

## 1.0.0 (2025-09-01)

This release adds features to setup and manage LocalStack from within VS Code. Features from initial preview release have been removed.

- feature: Add LocalStack installation and configuration setup wizard
- feature: Add LocalStack status bar indicator
- feature: Add `Start` and `Stop` LocalStack commands
- breaking change: Remove deploy and invoke Lambda features

## 0.2.0 (2025-08-18)

- feature: Add CodeLens support for JavaScript and TypeScript Lambda functions
- improvement: Remove requirement to use `samlocal` CLI, now uses `sam` CLI directly
- fix: Improve SAM template detection, now handling AWS SAM sample applications
- chore: Update all dependencies to latest versions

## 0.1.1 (2023-07-13)

- Update README with marketplace link
- Add animated GIFs for features

## 0.1.0 (2023-07-13)

Initial preview release.

- Add feature deploy Lambda to LocalStack
- Add feature invoke Lambda in LocalStack
- Add Python CodeLens for triggering deploy and invoke commands
