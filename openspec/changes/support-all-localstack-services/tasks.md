## 1. Service manifest (static, coverage-derived)

- [x] 1.1 Add a checked-in generator that reads `localstack-docs/src/data/coverage/*.json` and emits `resources/service-manifest.json` (one entry per service: AWS service-code `id`, display `name`; every service included, availability neither stored nor shown); document how `localstack-docs` is referenced and that regeneration is on-demand only
- [x] 1.2 Commit the generated `resources/service-manifest.json` and ensure esbuild/packaging bundles it
- [x] 1.3 Implement the manifest loader (`getManifest()`, `getEntry(id)`, `getAllServiceIds()`), memoized and validated
- [x] 1.4 Implement the service-code label mapping (lowercase + override table, e.g. `stepfunctions → states`) shared by the metamodel and CFN paths
- [x] 1.5 Unit-test manifest loading and label mapping (including `cognito-idp` and the Step Functions override)

## 2. Declarative provider engine

- [x] 2.1 Define the declarative format (`defineService(id, name, { <typeId>: { singular, plural, list, id, cfn, detailFrom, detail: [{ label, path, type }] } })`)
- [x] 2.2 Implement the engine that adapts a definition to the `ServiceProvider` interface (resource types, `getResourceArns`, `describeResource` by walking each field `path` over the response, `getArnResourceNameForCloudFormationResource`), routing SDK calls through `AWSConfig.getClientConfig`
- [x] 2.3 Keep the imperative `ServiceProvider` class as the escape hatch; ensure both register through `ProviderFactory` identically
- [x] 2.4 Unit-test the engine with a stubbed SDK: resource-type listing, identifier mapping, path-based detail rendering, and CFN mapping

## 3. Detail-field generator (build-time)

- [x] 3.1 Add a dev-time generator that reads a resource type's Describe/Get (or list-item) output shape from offline AWS API models (`aws-sdk` v2 `apis/*.normal.json` or botocore `service-2.json`; generator-only, not bundled)
- [x] 3.2 Implement the importance heuristic (identifiers/names → status → type → timestamps → scalars; collapse/drop nested; exclude metadata/pagination/blobs; cap ~12) and the `FieldType` mapping
- [x] 3.3 Emit `detail: [{ label, path, type }]` specs into the service definitions; output is committed and hand-editable

## 4. Manifest-backed provider registration + completeness

- [x] 4.1 Change `ProviderFactory` to register curated/declarative providers and resolve by manifest id; a manifest service with no provider is absent (no generic fallback)
- [x] 4.2 Add a completeness test that reports manifest service ids with no registered provider (runs as a coverage tracker until all batches land; green = done)
- [x] 4.3 Add a default-icon path for services without a bundled icon

## 5. Parity migration of the existing 7 providers

- [ ] 5.1 Re-express CloudFormation, DynamoDB, IAM, Lambda, SNS, SQS, Step Functions as declarative definitions (resource types, list/id, CFN mapping, detail fields)
- [ ] 5.2 Add parity tests diffing each migrated provider's resource types / list mapping / detail fields against the current imperative output
- [ ] 5.3 Remove the imperative versions once parity tests pass (or keep any that need the escape hatch), with `ProviderFactory` registering the definitions

## 6. Metamodel & CFN wiring

- [x] 6.1 Update `metamodelFocus` to map labels to manifest ids and include present services that have a registered provider; log present-but-uncurated services
- [x] 6.2 Update `cfnStackModel` to map resources of curated services via the provider; skip + log only unrepresentable / not-yet-curated resources
- [x] 6.3 Update the Resources view leaf to tolerate a non-ARN primary identifier (show verbatim when ARN parsing fails)
- [x] 6.4 Update/extend `metamodelFocus` and `cfnStackModel` tests for the new mapping behavior

## 7. Batch 1 — curated providers (10 services, flat, ≤5 resource types)

- [x] 7.1 S3 (`s3`): `Bucket`
- [x] 7.2 API Gateway (`apigateway`): `RestApi`, `Stage`, `ApiKey`, `UsagePlan`, `Authorizer`
- [x] 7.3 SSM (`ssm`): `Parameter`, `Document`, `MaintenanceWindow`, `Association`, `PatchBaseline`
- [x] 7.4 Secrets Manager (`secretsmanager`): `Secret`
- [x] 7.5 Kinesis (`kinesis`): `Stream`, `StreamConsumer`
- [x] 7.6 CloudWatch Logs (`logs`): `LogGroup`, `LogStream`, `MetricFilter`, `SubscriptionFilter`, `Destination`
- [x] 7.7 EventBridge (`events`): `EventBus`, `Rule`, `ApiDestination`, `Connection`, `Archive`
- [x] 7.8 KMS (`kms`): `Key`, `Alias`
- [~] 7.9 Cognito (`cognito-idp`): `UserPool`, `UserPoolClient`, `UserPoolGroup` done. `IdentityPool` deferred — it belongs to the separate `cognito-identity` service (different SDK client), not `cognito-idp`; tracked for a later batch.
- [x] 7.10 ECR (`ecr`): `Repository`
- [x] 7.11 Add the `@aws-sdk/client-*` dependencies and SDK client wrappers for the Batch 1 services (installed pinned to 3.901.0; one-time `minimumReleaseAge` bypass approved by the maintainer)
- [x] 7.12 Generate first-cut detail fields (group 3) for each Batch 1 resource type and hand-refine
- [x] 7.13 Unit-test each Batch 1 provider's list mapping and detail fields with stubbed SDK responses (representative coverage across every distinct provider pattern)

## 8. Tests, docs, verification

- [x] 8.1 Run the full test suite and confirm it passes (105 passing, 1 pending done-gate, 0 failing; `tsc` clean; `eslint` 0 errors)
- [x] 8.2 Update `README.md`/`CHANGELOG.md` to describe full-service coverage, the manifest, and the declarative provider model
- [ ] 8.3 Manual verification against a running emulator: Batch 1 services appear in "All Resources", drill down to live resources, show service-specific details, and appear in a `Stack:` listing — REQUIRES a running emulator + maintainer (cannot be automated here)
- [ ] 8.4 Manual verification against an AWS cloud profile: a Batch 1 service drills down and shows details via the same provider — REQUIRES a cloud profile + maintainer (cannot be automated here)

## 9. Subsequent batches (tracking)

- [ ] 9.1 Define Batch 2+ service lists (by popularity) and repeat the per-service curation until the completeness test (4.2) is green. After Batch 1, **17/116** manifest services have providers (the 7 imperative + 10 declarative); **99 remain**. The skipped "DONE GATE" test in `providerCompleteness.test.ts` becomes the completion signal — unskip it once coverage is complete.
- [ ] 9.2 Add Cognito `IdentityPool` once the `cognito-identity` service (separate SDK client) is curated — it was excluded from `cognito-idp` in Batch 1 (different service code/client).
- [ ] 9.3 Group 5 (deferred): migrate the 7 imperative providers to declarative definitions with parity tests, if/when desired — they remain registered as the sanctioned escape hatch in the meantime.
