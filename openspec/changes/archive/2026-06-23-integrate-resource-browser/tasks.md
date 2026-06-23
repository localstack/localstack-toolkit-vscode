## 1. Dependencies & scaffolding

- [x] 1.1 Add `@aws-sdk/client-{account,cloudformation,dynamodb,iam,lambda,sfn,sns,sqs,sts}` and `js-ini` to `package.json`; run `pnpm install`
- [x] 1.2 Create the platform layout `src/platforms/aws/{clients,services,models}` and `src/views/{localstack,resources,resource-details}`
- [x] 1.3 Verify esbuild bundles the AWS SDK with no missing-module errors

## 2. Platform-neutral Focus model

- [x] 2.1 Implement `src/models/focus.ts` (zod `Focus` schema + types, `StandardModel`, `loadStandardModel`) following Toolkit conventions
- [x] 2.2 Add error and `memoize` utilities under `src/utils/`
- [x] 2.3 Add focus fixtures (`mock-*.focus.json`) and `focus.ts` tests

## 3. AWS platform code

- [x] 3.1 Implement `src/platforms/aws/models/{arnModel,awsConfig,cfnStackModel,regionModel}.ts`
- [x] 3.2 Implement the AWS SDK client wrappers under `src/platforms/aws/clients/`, routing every client constructor through `AWSConfig.getClientConfig()` so `endpoint_url` is honored (D4)
- [x] 3.3 Implement `src/platforms/aws/services/{serviceProvider,providerFactory}.ts` and each service's `provider.ts`
- [x] 3.4 Add the model tests (`arnModel`, `awsConfig`, `cfnStackModel`) under `src/test/`

## 4. Resources & Resource Details views

- [x] 4.1 Implement `src/views/resources/{viewProvider,treeItems}.ts` (wildcard/`default` expansion)
- [x] 4.2 Implement the Resource Details view under `src/views/resource-details/`
- [x] 4.3 Merge the service + resource-type levels into a single `ResourceServiceTypeTreeItem` (label = service name, dimmed description = plural type); one row per (service, resource-type); ARN leaves carry no icon (D11)
- [x] 4.4 Render Resource Details as a `WebviewViewProvider`: self-contained CSP-locked themed key/value table, per-`FieldType` formatting, HTML-escaped values, placeholder/error states; `setArn`/`refresh` re-fetch via `describeResource` (D11)

## 5. Combined Explore view

- [x] 5.1 `src/views/localstack/treeItems.ts`: node classes for the three sections, profile/region nodes, focus selectors, placeholders, and error nodes
- [x] 5.2 `src/views/localstack/viewProvider.ts`: render LocalStack Instances (instance node + `App Inspector` + `View: All Resources` + saved instance views), Cloud Profiles (profiles → regions → selectors/`Stack:`/views), and Workspace IaC (`Coming soon`)
- [x] 5.3 Reuse `localStackStatusTracker` and `localstack.openAppInspector`; add `getLocalStackEndpoint()` reading the `localstack` profile's `endpoint_url` (DNS-default fallback); label the instance node `AWS (<Status>): <host:port>` from it, status folded onto the line (D5)
- [x] 5.4 Fix container-name detection: `createContainerStatusTracker` accepts multiple names (`["localstack-main","localstack-aws"]`) for both the `docker inspect`/`ps` check and the `docker events` stream
- [x] 5.5 Build Cloud Profiles `View: All Resources` as a wildcard focus and `Stack: <stack>` selectors via `cfnStackModel.toFocusModel()`; include the bundled `localstack` profile in Cloud Profiles
- [x] 5.6 Gate instance children on running state: `makeInstanceChildren()` returns `[]` unless running; a stopped instance renders as a plain non-expandable line
- [x] 5.7 Account label: `ResourceProfileTreeItem.description` = `(<accountId> - <alias>)`, or `(<accountId>)` with no trailing ` - ` when the alias is empty

## 6. LocalStack metamodel → Focus

- [x] 6.1 Promote the captured `metamodel-sample.json` (account → Service → region → operation → response) into `src/test/resources/` as the translation fixture
- [x] 6.2 Map service label → manifest id via `toLowerCase()` + an override table (Step Functions → `states`, unverified — emulator does not yet emit Step Functions state); shared by the metamodel and CFN paths
- [x] 6.3 Implement `src/platforms/aws/models/metamodelFocus.ts`: fetch `<getLocalStackEndpoint()>/_localstack/pods/state/metamodel` (lenient parse for raw control chars), filter to account `000000000000`, transpose to Focus, map/filter to services with a registered provider, dedup the `""` global region, leave ARNs as wildcards
- [x] 6.4 Name only present resource types: annotate each resource type with its metamodel list-operation (`metamodelOp`); the engine builds an op→type map (imperative multi-type providers override directly); `metamodelToFocus` includes only types whose operation key appears, falling back to the full type set (logged) when an op is unmappable (D6)
- [x] 6.5 Wire the LocalStack Instances `View: All Resources` selector to `metamodelFocus`; handle emulator-unavailable / fetch-failure non-fatally; log present services dropped for lack of a provider
- [x] 6.6 Fixture-based tests: service mapping, unsupported-service filtering, `""`-region dedup, present-types-only (SSM `describeParameters` → only Parameters), unmapped-op fallback

## 7. View wiring & plugin integration

- [x] 7.1 New `src/plugins/resource-browser.ts` plugin registers the three views (`localstack.instances`, `localstack.resources`, `localstack.resourceDetails`) and initializes `ProviderFactory`
- [x] 7.2 Wire selection events: focus-selector selection → `computeFocus` → `ResourceViewProvider`; Resources selection → `ResourceDetailsViewProvider.setArn`
- [x] 7.3 Remove the old `InstancesTreeDataProvider` from `app-inspector-webview.ts` (keep the App Inspector command); register the new plugin in `extension.ts`
- [x] 7.4 `package.json` `contributes.views`: add `Resources` and `Resource Details` to `localstackActivityBar`; name the instances view "Explore"; relative `size` weights (Resources `2`, others `1`) for ~50/25/25 first layout
- [x] 7.5 Refresh on `statusTracker.onChange` (rebuild the instance label + App Inspector description) and on `onDidChangeConfiguration` for the view-state keys
- [x] 7.6 Add `localstack.refreshResources` / `localstack.refreshResourceDetails` (`$(refresh)`, `view/title` navigation group); the Resources refresh recomputes the focus via a stored focus **producer** so a LocalStack instance re-queries the metamodel and picks up new resources

## 8. Settings persistence

- [x] 8.1 Add a shared `configTarget()` (Workspace when a folder is open, else Global) and a JSON deep-clone helper (VS Code config objects are not structured-cloneable); use them for all view-state writes
- [x] 8.2 `localstack.cloudProfiles.regions`: `Select Regions...` multi-select replaces the user-added set in one action; the configured default region is always shown and never removable
- [x] 8.3 `localstack.cloudProfiles.shown` (opt-in): unset ⇒ `["default"]` (or the first profile when none is named `default`); `Select Profiles...` pre-checks and persists the shown set; an empty set shows a `No profiles selected` placeholder
- [x] 8.4 `localstack.cloudProfiles.filters`: per-filter value stores `{ name, resources: { service, resourceType }[], scope }`; the wizard lists service/resource-type pairs (`"<Service> — <Plural Type>"`), validates name uniqueness, reserves `All Resources` (case-insensitive), and offers `This region only` / `All regions in this profile`
- [x] 8.5 `Add View...` / `Edit View...` (re-run wizard pre-populated) / `Remove View` (modal confirm); `Remove Region` (modal confirm)

## 9. Single-select focus selectors

- [x] 9.1 Register the instances tree once with `canSelectMany: false` and a single selection listener
- [x] 9.2 `computeFocus` returns the single selected focus selector's focus (`undefined` when nothing focusable is selected); no `mergeFocuses` (D8)

## 10. Explore UX (final state)

> The labels, icons, and affordances below are the landed result of several rounds of in-editor feedback.

- [x] 10.1 Focus-selector labels: `View: All Resources`, saved views `View: <name>`, CloudFormation `Stack: <name>`; focus selectors carry a transparent `blank` icon so the instance's `View: All Resources` aligns under `App Inspector` (the only use of `blank`; other iconless rows render with no icon column)
- [x] 10.2 App Inspector node: `$(search)` icon, `Click to open` description (only rendered when running)
- [x] 10.3 Row actions are inline icons **and** right-click context items (D10): pencil for `Select Profiles...` / `Select Regions...` / `Edit View...`, plus for `Add View...`, trash for `Remove Region` / `Remove View`
- [x] 10.4 ESLint typing cleanup: remove the per-file `no-unsafe-*` override for the AWS platform modules and fix the underlying code with real types (typed SDK responses, zod parsing for dynamic JSON, a typed `memoize` generic)

## 11. Target-aware icons (no AWS-derived art)

- [x] 11.1 Delete the 6 AWS-derived service SVGs in `resources/icons/services/`; remove `ServiceProvider.getIconPath` with its `fs`/`path` imports and `symbol-misc` fallback (and the orphaned `context` plumbing)
- [x] 11.2 Resolve `isLocalStack` per profile in `makeResourceProfiles` (custom/local `endpoint_url`, or the synthetic `localstack` profile ⇒ LocalStack; otherwise AWS; never throws); store it on `ResourceProfileTreeItem`
- [x] 11.3 `ResourceServiceTypeTreeItem` sets `iconPath` to `ThemeIcon("localstack-logo")` (LocalStack) or `ThemeIcon("cloud")` (AWS) via the parent chain; ARN leaves keep no icon
- [x] 11.4 Test: a LocalStack-targeted row resolves to `localstack-logo` and an AWS-targeted row to `cloud`; `getEndpointForProfile` tests

## 12. Service manifest (static, coverage-derived)

- [x] 12.1 Checked-in generator reads `localstack-docs/src/data/coverage/*.json` and emits `resources/service-manifest.json` (one `{ id, name }` per service, AWS service-code id, every service, availability neither stored nor shown); regeneration on demand only
- [x] 12.2 Commit the generated manifest; ensure esbuild/packaging bundles it
- [x] 12.3 Memoized, validated loader (`getManifest()`, `getEntry(id)`, `getAllServiceIds()`)
- [x] 12.4 Service-code label mapping (lowercase + override table, e.g. `stepfunctions → states`) shared by the metamodel and CFN paths
- [x] 12.5 Unit-test manifest loading and label mapping (incl. `cognito-idp` and the Step Functions override)

## 13. Declarative provider engine

- [x] 13.1 Define the format `defineService(id, name, { <typeId>: { singular, plural, list, id, cfn, detailFrom, detail, metamodelOp } })`
- [x] 13.2 Engine adapts a definition to `ServiceProvider` (resource types, `getResourceArns`, `describeResource` by walking each field `path`, CFN mapping, op→type map), routing SDK calls through `getClientConfig`
- [x] 13.3 Keep the imperative `ServiceProvider` class as the escape hatch; both register through `ProviderFactory` identically
- [x] 13.4 Unit-test the engine with a stubbed SDK: resource-type listing, identifier mapping, path-based detail rendering, CFN mapping

## 14. Detail-field generator (build-time)

- [x] 14.1 Dev-time generator reads a resource type's Describe/Get (or list-item) shape from offline AWS API models (`aws-sdk` v2 `apis/*.normal.json` / botocore `service-2.json`; generator-only, not bundled)
- [x] 14.2 Importance heuristic (identifiers/names → status → type → timestamps → scalars; collapse/drop nested; exclude metadata/pagination/blobs; cap ~12) + `FieldType` mapping
- [x] 14.3 Emit `detail: [{ label, path, type }]` into the definitions; committed and hand-editable

## 15. Manifest-backed provider registration + completeness

- [x] 15.1 `ProviderFactory` registers curated/declarative providers and resolves by manifest id; a manifest service with no provider is absent (no generic fallback)
- [x] 15.2 Completeness test reports manifest ids with no registered provider (runs as a coverage tracker; green = done)
- [x] 15.3 Default-icon path for services without a bundled icon

## 16. Batch 1 — curated providers (flat, ≤5 resource types)

- [x] 16.1 S3 (`s3`): `Bucket`
- [x] 16.2 API Gateway (`apigateway`): `RestApi`, `Stage`, `ApiKey`, `UsagePlan`, `Authorizer`
- [x] 16.3 SSM (`ssm`): `Parameter`, `Document`, `MaintenanceWindow`, `Association`, `PatchBaseline`
- [x] 16.4 Secrets Manager (`secretsmanager`): `Secret`
- [x] 16.5 Kinesis (`kinesis`): `Stream`, `StreamConsumer`
- [x] 16.6 CloudWatch Logs (`logs`): `LogGroup`, `LogStream`, `MetricFilter`, `SubscriptionFilter`, `Destination`
- [x] 16.7 EventBridge (`events`): `EventBus`, `Rule`, `ApiDestination`, `Connection`, `Archive`
- [x] 16.8 KMS (`kms`): `Key`, `Alias`
- [~] 16.9 Cognito (`cognito-idp`): `UserPool`, `UserPoolClient`, `UserPoolGroup` done; `IdentityPool` deferred (it belongs to the separate `cognito-identity` service / SDK client)
- [x] 16.10 ECR (`ecr`): `Repository`
- [x] 16.11 Add the Batch 1 `@aws-sdk/client-*` dependencies and SDK client wrappers (pinned `3.901.0`)
- [x] 16.12 Generate first-cut detail fields per Batch 1 resource type and hand-refine
- [x] 16.13 Unit-test each Batch 1 provider's list mapping and detail fields with stubbed SDK responses

## 17. Metamodel & CFN wiring for full coverage

- [x] 17.1 `metamodelFocus` maps labels to manifest ids and includes present services with a registered provider; logs present-but-uncurated services
- [x] 17.2 `cfnStackModel` maps resources of curated services via the provider; skips + logs only unrepresentable / not-yet-curated resources (D16)
- [x] 17.3 Resources view leaf tolerates a non-ARN primary identifier (shows it verbatim)
- [x] 17.4 Update/extend `metamodelFocus` and `cfnStackModel` tests for the new mapping behavior

## 18. Browser fixes

- [x] 18.1 (#1 region-less describe) `AWSConfig.getClientConfig` falls back to `getRegionForProfile(profile)` then `us-east-1` when region is empty; listing unchanged; test added (D17)
- [x] 18.2 (#2 details column) `table-layout: fixed; td.field { width:33%; white-space:normal; overflow-wrap:break-word; } td.value { width:67% }`
- [x] 18.3 (#3 remove multi-select) remove the `localstack.focus.multiSelect` setting, the enable/disable commands + menus, the `localstack.multiSelect` context key, and `mergeFocuses` (+ its tests); single `canSelectMany:false` registration
- [x] 18.4 (#4 live edit refresh) saved-view focus producers resolve their definition live by (profile, name); add/edit/remove command handlers refresh the Resources view; removing the active view reverts to the placeholder; test added (D18)
- [x] 18.5 (#5 instance views) store instance views under the dedicated `localstack.instanceViews` key (no region scope); wizard omits the region-scope step for the instance entry point; focus = `computeMetamodelFocus` intersected with the chosen pairs; `Add View...` on the instance node, `Edit View...`/`Remove View` on instance view rows; test added (D19)

## 19. Tests, docs & verification

- [x] 19.1 `pnpm lint` + `pnpm run check-types` clean; full test suite passes
- [x] 19.2 Update `README.md` / `CHANGELOG.md` to describe the Resources and Resource Details views, full-service coverage, the manifest, and the declarative provider model
- [x] 19.3 Manual verification (foundation): instance `View: All Resources` (metamodel) with no "security token" error, Cloud Profiles drill-down, a `Stack:` selector, add/edit/remove view and region, target-aware icons under light/dark themes, and the refresh buttons all work; Resource Details populates — confirmed by the maintainer
- [ ] 19.4 Manual smoke (fixes + Batch 1): S3 details load; long labels wrap; no multi-select toggle; editing an active view refreshes Resources; `View: All Resources` shows only present resource types; instance views intersect the metamodel; Batch 1 services appear in "All Resources", drill down to live resources, show service-specific details, and appear in a `Stack:` listing — REQUIRES a running emulator / cloud profile + maintainer; not automatable here

## 20. Remaining coverage (tracking)

- [ ] 20.1 Subsequent batches (by popularity) until the completeness test (15.2) is green. After Batch 1, **17/116** manifest services have providers (7 imperative + 10 declarative); **99 remain**. Unskip the "DONE GATE" test in `providerCompleteness.test.ts` once coverage is complete
- [ ] 20.2 Add Cognito `IdentityPool` once the `cognito-identity` service (separate SDK client) is curated
- [ ] 20.3 Parity migration (deferred): re-express the 7 imperative providers (CloudFormation, DynamoDB, IAM, Lambda, SNS, SQS, Step Functions) as declarative definitions with parity tests, if/when desired — they remain the sanctioned escape hatch in the meantime
