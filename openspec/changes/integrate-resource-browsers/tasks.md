## 1. Dependencies & scaffolding

- [ ] 1.1 Add `@aws-sdk/client-{account,cloudformation,dynamodb,iam,lambda,sfn,sns,sqs,sts}` and `js-ini` to `package.json` and run `pnpm install`
- [ ] 1.2 Create the platform directory layout `src/platforms/aws/{clients,services,models}` and `src/views/{localstack,resources,resource-details}`
- [ ] 1.3 Verify esbuild bundles the AWS SDK (`pnpm run compile:extension`) with no missing-module errors

## 2. Port platform-neutral Focus model

- [ ] 2.1 Port `focusModel.ts` to `src/models/focus.ts` (zod `Focus` schema + types, `StandardModel`, `loadStandardModel`), adapted to Toolkit conventions (tabs, `node:` imports, `.ts` extensions)
- [ ] 2.2 Add a `mergeFocuses(focuses: Focus[]): Focus | undefined` helper (union of profiles/regions/services/resource types/ARNs, dedup by id) per the `focus-model` spec
- [ ] 2.3 Port `shared/errors.ts` and `shared/memoize.ts` into `src/utils/`
- [ ] 2.4 Port focus fixtures (`mock-*.focus.json`) and `focus.ts` tests; add a `mergeFocuses` unit test

## 3. Port AWS platform code

- [ ] 3.1 Port `models/{arnModel,awsConfig,cfnStackModel,regionModel}.ts` into `src/platforms/aws/models/`
- [ ] 3.2 Port `awsClients/*` into `src/platforms/aws/clients/`, routing every SDK client constructor through `awsConfig.getClientConfig()` so `endpoint_url` is honored (D4)
- [ ] 3.3 Port `services/{serviceProvider,providerFactory}.ts` and each `services/<service>/provider.ts` into `src/platforms/aws/services/`
- [ ] 3.4 Move the service icon assets into `resources/icons/services/` and fix `getIconPath`
- [ ] 3.5 Port the model tests (`arnModel`, `awsConfig`, `cfnStackModel`) into `src/test/`

## 4. Resources & Resource Details views

- [ ] 4.1 Port `resourcesView/{viewProvider,treeItems}.ts` into `src/views/resources/` (keeps wildcard/`default` expansion from the `focus-model` + `resource-browser` specs)
- [ ] 4.2 Port `resourceDetailsView/{viewProvider}.ts` into `src/views/resource-details/`
- [ ] 4.3 Port the resources/resource-details view tests and fixtures

## 5. Combined LocalStack view

- [ ] 5.1 Create `src/views/localstack/treeItems.ts` with node classes for the three sections, profile/region nodes, focus selectors, the `Add new region`/`Add new filter` action nodes, the `Coming soon` placeholder, and error/placeholder nodes
- [ ] 5.2 Create `src/views/localstack/viewProvider.ts` implementing `LocalStackViewProvider`: render LocalStack Instances (instance node + `Status` + `App Inspector` + `All Resources`), Cloud Profiles (profiles → regions → selectors/CFN/actions), and Workspace IaC (`Coming soon`)
- [ ] 5.3 Reuse `localStackStatusTracker` for the `Status` node and the `localstack.openAppInspector` command for the `App Inspector` node (preserve existing behavior)
- [ ] 5.3a Add a `getLocalStackEndpoint()` helper that reads the `localstack` profile's `endpoint_url` from `~/.aws/config` (reusing existing INI utilities), falling back to the Toolkit's DNS-based default; label the instance node `AWS: <host:port>` from it instead of the hardcoded string
- [ ] 5.4 Build Cloud Profiles `All Resources` as a wildcard focus and `CFN: <stack>` selectors via `cfnStackModel.toFocusModel()`
- [ ] 5.5 Include the bundled `localstack` profile in Cloud Profiles (shown alongside the LocalStack Instances section, not hidden)

## 6. LocalStack metamodel → Focus (Vision 1: selector)

- [ ] 6.1 Promote the captured `metamodel-sample.json` (shape: account → Service → region → operation → response) into `src/test/resources/` as the translation fixture; gather more samples to complete the service-label map
- [ ] 6.2 Map service label → provider id via `label.toLowerCase()` plus a small override map (best-guess `StepFunctions→states`, unverified — emulator does not yet return Step Functions in the metamodel; finalize when that bug is fixed)
- [ ] 6.3 Implement `src/platforms/aws/models/metamodelFocus.ts`: fetch `<getLocalStackEndpoint()>/_localstack/pods/state/metamodel` (not a literal URL; lenient JSON parse — payload can contain raw control characters), filter to account `000000000000`, transpose to Focus, map+filter to supported services, dedup the `""` global region, and emit each service's resource types with wildcard ARNs (`localstack-metamodel` spec)
- [ ] 6.4 Wire the LocalStack Instances `All Resources` selector to `metamodelFocus`
- [ ] 6.5 Handle emulator-unavailable / fetch-failure with a non-fatal error state
- [ ] 6.6 Add a fixture-based test for the metamodel translation (incl. service mapping, unsupported-service filtering, `""`-region dedup)
- [ ] 6.7 Log/surface which present services were dropped for lack of a provider (R-cov)

## 6b. LocalStack metamodel as data source (Vision 2 — DEFERRED, out of scope for this change)

> Decided: v1 omits metamodel services that have no provider. Captured here only so the idea isn't lost; do **not** implement as part of this change.

- [ ] 6b.1 (future change) Generic `MetamodelServiceProvider` that renders any present service/resourcetype/ARN in the Resources *tree* straight from the captured JSON (table-driven collection-key/ARN-field extraction, tolerant of missing ARNs). Note: Resource Details still uses the SDK `describeResource` path — decided, not revisited by Vision 2.

## 7. View wiring & plugin integration

- [ ] 7.1 Create a new `src/plugins/resource-browser.ts` plugin that registers the three tree views (`localstack.instances`, `localstack.resources`, `localstack.resourceDetails`) and initializes `ProviderFactory`
- [ ] 7.2 Wire selection events: LocalStack focus-selector selection → compute focus → `ResourceViewProvider.setFocus`; Resources selection → `ResourceDetailsViewProvider.setArn`
- [ ] 7.3 Remove the old `InstancesTreeDataProvider` from `app-inspector-webview.ts`, keeping the App Inspector webview command; register the new plugin in `extension.ts`
- [ ] 7.4 Update `package.json` `contributes.views` to add `Resources` and `Resource Details` to the `localstackActivityBar` container

## 8. Settings persistence (regions & filters)

- [ ] 8.1 Add `contributes.configuration` keys `localstack.cloudProfiles.regions`, `localstack.cloudProfiles.filters`, and `localstack.focus.multiSelect`; register the `localstack.addRegion`/`removeRegion`/`addFilter`/`editFilter`/`removeFilter` commands
- [ ] 8.2 Implement `Add new region`: single-select quick-pick of regions not already shown → persist to `localstack.cloudProfiles.regions` → refresh; render the profile's configured default region (always, not removable) plus user-added regions
- [ ] 8.3 Implement `Remove region`: context-menu action on a user-added region node → remove that one region from `localstack.cloudProfiles.regions` → refresh (the configured default region offers no Remove action)
- [ ] 8.4 Implement `Add new filter` as a 3-step Option-A wizard: (1) `showInputBox` name with unique-per-profile validation → (2) `showQuickPick({canPickMany:true})` of supported services (≥1 required) → (3) single-select scope `This region only` / `All regions in this profile`; persist to `localstack.cloudProfiles.filters` with `scope` = `{ region }` or `{ allRegions: true }`; render each region's filters (its own + the profile's `allRegions` filters) as focus selectors scoped to the chosen services
- [ ] 8.5 Implement `Edit filter`: context-menu action that re-runs the 3-step wizard pre-populated with the filter's current name/services/scope and overwrites it
- [ ] 8.6 Implement `Remove filter`: context-menu action that deletes the filter from settings → refresh
- [ ] 8.7 Contribute `view/item/context` menus in `package.json` keyed on tree-item `contextValue` (e.g. `localstackFilter` → Edit/Remove; `localstackUserRegion` → Remove), with inline icons where appropriate
- [ ] 8.8 Refresh the LocalStack view on `onDidChangeConfiguration` for these keys

## 9. Multi-select

- [ ] 9.1 Track the active set of selected focus selectors in `LocalStackViewProvider`; in single-select mode keep only the latest
- [ ] 9.2 On selection change, compute each selector's focus and merge via `mergeFocuses` before `setFocus`
- [ ] 9.3 Register the tree view with `canSelectMany` driven by `localstack.focus.multiSelect`; on toggle, re-register (dispose + recreate) the view in place with the new value, restoring the prior selection — no reload prompt
- [ ] 9.4 Add the toggle to the view's `...` menu: `localstack.enableMultiSelect`/`disableMultiSelect` commands in `contributes.menus` → `view/title` with `when: view == localstack.instances && [!]localstack.multiSelect`; drive visibility with a `localstack.multiSelect` context key via `setContext`
- [ ] 9.5 Add a test for merged multi-selection focus

## 10. Verification & cleanup

- [ ] 10.1 `pnpm lint` and `pnpm run format` (biome) pass on all ported/new files; fix convention drift (tabs, `node:` imports, `.ts` extensions, `import type`)
- [ ] 10.2 `pnpm run check-types` passes
- [ ] 10.3 `pnpm test` passes (ported + new tests)
- [ ] 10.4 Manual verification against a running emulator: LocalStack Instances `All Resources` (metamodel), Cloud Profiles drill-down, a `CFN:` selector, add/remove region, add/edit/remove filter (3-step wizard, both scopes), and multi-select toggle all work; Resource Details populates
- [ ] 10.5 Update `README.md`/`CHANGELOG.md` to describe the new Resources and Resource Details views
