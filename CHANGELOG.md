# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.4.0](https://github.com/localstack/localstack-toolkit-vscode/compare/v1.2.3...v1.4.0) (2026-03-27)


### Features

* improve cli detection ([#60](https://github.com/localstack/localstack-toolkit-vscode/issues/60)) ([aa0520a](https://github.com/localstack/localstack-toolkit-vscode/commit/aa0520a2171c73c92e15cf87d435b20df8a334d8))
* support more vscode-flavored editors ([#81](https://github.com/localstack/localstack-toolkit-vscode/issues/81)) ([2cb6d20](https://github.com/localstack/localstack-toolkit-vscode/commit/2cb6d2018ad767b17357133bcb72c2905e44737e)), closes [#79](https://github.com/localstack/localstack-toolkit-vscode/issues/79)


### Bug Fixes

* license check in status tracker ([#63](https://github.com/localstack/localstack-toolkit-vscode/issues/63)) ([90fc99b](https://github.com/localstack/localstack-toolkit-vscode/commit/90fc99b158e1b33fba34fcd6753e55bdd8bad399))
* license check in status tracker ([#73](https://github.com/localstack/localstack-toolkit-vscode/issues/73)) ([9c18ee2](https://github.com/localstack/localstack-toolkit-vscode/commit/9c18ee28e873810da849c9b3b3b39d6374c0e8d6))
* localstack installation on ubuntu/i3 ([#77](https://github.com/localstack/localstack-toolkit-vscode/issues/77)) ([71577ac](https://github.com/localstack/localstack-toolkit-vscode/commit/71577ac8fa0dd3df18700d846eae8f982b55c0c6))
* Revert "feat: improve cli detection" ([#65](https://github.com/localstack/localstack-toolkit-vscode/issues/65)) ([ee64584](https://github.com/localstack/localstack-toolkit-vscode/commit/ee6458493428c2a0832d257b17a40d4254fda35f)), closes [localstack/localstack-toolkit-vscode#60](https://github.com/localstack/localstack-toolkit-vscode/issues/60) [#60](https://github.com/localstack/localstack-toolkit-vscode/issues/60) [#64](https://github.com/localstack/localstack-toolkit-vscode/issues/64) [#60](https://github.com/localstack/localstack-toolkit-vscode/issues/60)
* revert "fix: license check in status tracker" ([#64](https://github.com/localstack/localstack-toolkit-vscode/issues/64)) ([dfef829](https://github.com/localstack/localstack-toolkit-vscode/commit/dfef829c2223dd3161578baa09aad030a56baabf)), closes [localstack/localstack-toolkit-vscode#63](https://github.com/localstack/localstack-toolkit-vscode/issues/63) [#60](https://github.com/localstack/localstack-toolkit-vscode/issues/60)
* void unhandled promise return values in configure-aws ([#105](https://github.com/localstack/localstack-toolkit-vscode/issues/105)) ([2dc3847](https://github.com/localstack/localstack-toolkit-vscode/commit/2dc3847b006dbb2f55b2865af5817169ed61b106))

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
