## 1. Dependencies & scaffolding

- [x] 1.1 Add `@aws-sdk/client-{account,cloudformation,dynamodb,iam,lambda,sfn,sns,sqs,sts}` and `js-ini` to `package.json` and run `pnpm install`
- [x] 1.2 Create the platform directory layout `src/platforms/aws/{clients,services,models}` and `src/views/{localstack,resources,resource-details}`
- [x] 1.3 Verify esbuild bundles the AWS SDK (`pnpm run compile:extension`) with no missing-module errors

## 2. Port platform-neutral Focus model

- [x] 2.1 Port `focusModel.ts` to `src/models/focus.ts` (zod `Focus` schema + types, `StandardModel`, `loadStandardModel`), adapted to Toolkit conventions (tabs, `node:` imports, `.ts` extensions)
- [x] 2.2 Add a `mergeFocuses(focuses: Focus[]): Focus | undefined` helper (union of profiles/regions/services/resource types/ARNs, dedup by id) per the `focus-model` spec
- [x] 2.3 Port `shared/errors.ts` and `shared/memoize.ts` into `src/utils/`
- [x] 2.4 Port focus fixtures (`mock-*.focus.json`) and `focus.ts` tests; add a `mergeFocuses` unit test

## 3. Port AWS platform code

- [x] 3.1 Port `models/{arnModel,awsConfig,cfnStackModel,regionModel}.ts` into `src/platforms/aws/models/`
- [x] 3.2 Port `awsClients/*` into `src/platforms/aws/clients/`, routing every SDK client constructor through `awsConfig.getClientConfig()` so `endpoint_url` is honored (D4)
- [x] 3.3 Port `services/{serviceProvider,providerFactory}.ts` and each `services/<service>/provider.ts` into `src/platforms/aws/services/`
- [x] 3.4 Move the service icon assets into `resources/icons/services/` and fix `getIconPath`
- [ ] 3.5 Port the model tests (`arnModel`, `awsConfig`, `cfnStackModel`) into `src/test/`

## 4. Resources & Resource Details views

- [x] 4.1 Port `resourcesView/{viewProvider,treeItems}.ts` into `src/views/resources/` (keeps wildcard/`default` expansion from the `focus-model` + `resource-browser` specs)
- [x] 4.2 Port `resourceDetailsView/{viewProvider}.ts` into `src/views/resource-details/`
- [ ] 4.3 Port the resources/resource-details view tests and fixtures

## 5. Combined LocalStack view

- [x] 5.1 Create `src/views/localstack/treeItems.ts` with node classes for the three sections, profile/region nodes, focus selectors, the `Add new region`/`Add new filter` action nodes, the `Coming soon` placeholder, and error/placeholder nodes
- [x] 5.2 Create `src/views/localstack/viewProvider.ts` implementing `LocalStackViewProvider`: render LocalStack Instances (instance node + `Status` + `App Inspector` + `All Resources`), Cloud Profiles (profiles → regions → selectors/CFN/actions), and Workspace IaC (`Coming soon`)
- [x] 5.3 Reuse `localStackStatusTracker` for the `Status` node and the `localstack.openAppInspector` command for the `App Inspector` node (preserve existing behavior)
- [x] 5.3a Add a `getLocalStackEndpoint()` helper that reads the `localstack` profile's `endpoint_url` from `~/.aws/config` (reusing existing INI utilities), falling back to the Toolkit's DNS-based default; label the instance node `AWS: <host:port>` from it instead of the hardcoded string
- [x] 5.4 Build Cloud Profiles `All Resources` as a wildcard focus and `CFN: <stack>` selectors via `cfnStackModel.toFocusModel()`
- [x] 5.5 Include the bundled `localstack` profile in Cloud Profiles (shown alongside the LocalStack Instances section, not hidden)

## 6. LocalStack metamodel → Focus (Vision 1: selector)

- [x] 6.1 Promote the captured `metamodel-sample.json` (shape: account → Service → region → operation → response) into `src/test/resources/` as the translation fixture; gather more samples to complete the service-label map
- [x] 6.2 Map service label → provider id via `label.toLowerCase()` plus a small override map (best-guess `StepFunctions→states`, unverified — emulator does not yet return Step Functions in the metamodel; finalize when that bug is fixed)
- [x] 6.3 Implement `src/platforms/aws/models/metamodelFocus.ts`: fetch `<getLocalStackEndpoint()>/_localstack/pods/state/metamodel` (not a literal URL; lenient JSON parse — payload can contain raw control characters), filter to account `000000000000`, transpose to Focus, map+filter to supported services, dedup the `""` global region, and emit each service's resource types with wildcard ARNs (`localstack-metamodel` spec)
- [x] 6.4 Wire the LocalStack Instances `All Resources` selector to `metamodelFocus`
- [x] 6.5 Handle emulator-unavailable / fetch-failure with a non-fatal error state
- [x] 6.6 Add a fixture-based test for the metamodel translation (incl. service mapping, unsupported-service filtering, `""`-region dedup)
- [x] 6.7 Log/surface which present services were dropped for lack of a provider (R-cov)

## 6b. LocalStack metamodel as data source (Vision 2 — DEFERRED, out of scope for this change)

> Decided: v1 omits metamodel services that have no provider. Captured here only so the idea isn't lost; do **not** implement as part of this change.

- [ ] 6b.1 (future change) Generic `MetamodelServiceProvider` that renders any present service/resourcetype/ARN in the Resources *tree* straight from the captured JSON (table-driven collection-key/ARN-field extraction, tolerant of missing ARNs). Note: Resource Details still uses the SDK `describeResource` path — decided, not revisited by Vision 2.

## 7. View wiring & plugin integration

- [x] 7.1 Create a new `src/plugins/resource-browser.ts` plugin that registers the three tree views (`localstack.instances`, `localstack.resources`, `localstack.resourceDetails`) and initializes `ProviderFactory`
- [x] 7.2 Wire selection events: LocalStack focus-selector selection → compute focus → `ResourceViewProvider.setFocus`; Resources selection → `ResourceDetailsViewProvider.setArn`
- [x] 7.3 Remove the old `InstancesTreeDataProvider` from `app-inspector-webview.ts`, keeping the App Inspector webview command; register the new plugin in `extension.ts`
- [x] 7.4 Update `package.json` `contributes.views` to add `Resources` and `Resource Details` to the `localstackActivityBar` container

## 8. Settings persistence (regions & filters)

- [x] 8.1 Add `contributes.configuration` keys `localstack.cloudProfiles.regions`, `localstack.cloudProfiles.filters`, and `localstack.focus.multiSelect`; register the `localstack.addRegion`/`removeRegion`/`addFilter`/`editFilter`/`removeFilter` commands
- [x] 8.2 Implement `Add new region`: single-select quick-pick of regions not already shown → persist to `localstack.cloudProfiles.regions` → refresh; render the profile's configured default region (always, not removable) plus user-added regions
- [x] 8.3 Implement `Remove region`: context-menu action on a user-added region node → remove that one region from `localstack.cloudProfiles.regions` → refresh (the configured default region offers no Remove action)
- [x] 8.4 Implement `Add new filter` as a 3-step Option-A wizard: (1) `showInputBox` name with unique-per-profile validation → (2) `showQuickPick({canPickMany:true})` of supported services (≥1 required) → (3) single-select scope `This region only` / `All regions in this profile`; persist to `localstack.cloudProfiles.filters` with `scope` = `{ region }` or `{ allRegions: true }`; render each region's filters (its own + the profile's `allRegions` filters) as focus selectors scoped to the chosen services
- [x] 8.5 Implement `Edit filter`: context-menu action that re-runs the 3-step wizard pre-populated with the filter's current name/services/scope and overwrites it
- [x] 8.6 Implement `Remove filter`: context-menu action that deletes the filter from settings → refresh
- [x] 8.7 Contribute `view/item/context` menus in `package.json` keyed on tree-item `contextValue` (e.g. `localstackFilter` → Edit/Remove; `localstackUserRegion` → Remove), with inline icons where appropriate
- [x] 8.8 Refresh the LocalStack view on `onDidChangeConfiguration` for these keys

## 9. Multi-select

- [x] 9.1 Track the active set of selected focus selectors in `LocalStackViewProvider`; in single-select mode keep only the latest
- [x] 9.2 On selection change, compute each selector's focus and merge via `mergeFocuses` before `setFocus`
- [x] 9.3 Register the tree view with `canSelectMany` driven by `localstack.focus.multiSelect`; on toggle, re-register (dispose + recreate) the view in place with the new value, restoring the prior selection — no reload prompt
- [x] 9.4 Add the toggle to the view's `...` menu: `localstack.enableMultiSelect`/`disableMultiSelect` commands in `contributes.menus` → `view/title` with `when: view == localstack.instances && [!]localstack.multiSelect`; drive visibility with a `localstack.multiSelect` context key via `setContext`
- [x] 9.5 Add a test for merged multi-selection focus

## 10. Verification & cleanup

- [x] 10.1 `pnpm lint` and `pnpm run format` (biome) pass on all ported/new files; fix convention drift (tabs, `node:` imports, `.ts` extensions, `import type`)
- [x] 10.2 `pnpm run check-types` passes
- [ ] 10.3 `pnpm test` passes (ported + new tests)
- [ ] 10.4 Manual verification against a running emulator: LocalStack Instances `All Resources` (metamodel), Cloud Profiles drill-down, a `CFN:` selector, add/remove region, add/edit/remove filter (3-step wizard, both scopes), and multi-select toggle all work; Resource Details populates
- [x] 10.5 Update `README.md`/`CHANGELOG.md` to describe the new Resources and Resource Details views

## 11. UX refinements (post-play feedback)

- [x] 11.1 Rename the view: `package.json` `contributes.views.localstackActivityBar` entry `localstack.instances` `name` "LocalStack" → "Explore" (container title stays "LocalStack")
- [x] 11.2 Initial sizing: add relative `size` weights to the three `localstackActivityBar` view contributions — `localstack.resources` `size: 2`, `localstack.instances` and `localstack.resourceDetails` `size: 1` — for ~50/25/25 on first layout
- [x] 11.3 Fold status onto the instance line: change `InstanceTreeItem` label to `AWS (<Status>): <host:port>` with the status word capitalized; remove the standalone `StatusTreeItem` node and drop it from `makeInstanceChildren()`
- [x] 11.4 Re-wire live status updates: on `statusTracker.onChange`, refresh the instance node (rebuild its label and the `App Inspector` description) instead of the now-removed `#statusItem`; e.g. fire `onDidChangeTreeData` for the instances section/instance node
- [x] 11.5 App Inspector node: set `iconPath = new ThemeIcon("search")`; pass the current running state into the node so its description is `Click to open` when running and `Not running` otherwise (and disable/guard the open command when not running)
- [x] 11.6 Section separators: add a non-interactive `SeparatorTreeItem` (dash-run label) and interleave it between the three sections in `getChildren()` root (between adjacent pairs only, not before first / after last)
- [x] 11.7 Fix container-name detection: change `createContainerStatusTracker` to accept multiple container names (`string[]`); pass `["localstack-main", "localstack-aws"]` from `extension.ts`; in `container-status.ts` repeat `--filter container=<name>` per name in `docker events`, change the event schema gate to set-membership on the actor name, and have `getContainerStatus` inspect each name and report `running` if any is running
- [ ] 11.8 Verify against a `lstk`-started emulator (container `localstack-aws`): status shows `Running`, App Inspector description flips to `Click to open`, separators render, and the Resources view takes ~50% height on first open

## 12. UX refinements (second round)

- [x] 12.1 Separator: VS Code can't size labels to the panel and always ellipsizes overflow, so use a short fixed dash run (`"─".repeat(12)`) to avoid the trailing `…` at typical widths (mitigation, not full-width)
- [x] 12.2 Fix `#<Object> could not be cloned` on add region/view: replace `structuredClone(configMap())` in `settings.ts` with a JSON deep-clone (`cloneJson`), since VS Code config objects are not structured-cloneable; applies to all region/filter mutators
- [x] 12.3 Hide/reveal Cloud Profiles: add an inline "Show Cloud Profiles" action (`$(eye)`) on the Cloud Profiles section that opens a multi-select quick-pick (checked = visible); persist hidden names to a new `localstack.cloudProfiles.hidden` workspace setting (never touch `~/.aws/config`); `makeProfiles()` filters hidden profiles; all visible initially
- [x] 12.4 Rename "Filter" → "View" in the UX only: tree labels ("Add new view"), command titles (Add/Edit/Remove view), and wizard strings; keep internal command ids, `contextValue`s, and the `cloudProfiles.filters` settings key stable (no migration)
- [x] 12.5 "Add new region" → "Show more regions": multi-select quick-pick pre-checked with currently-added regions (default region excluded — always shown), replacing the added set via `setAddedRegions` so one action adds and removes; empty selection is a valid "hide all"
- [x] 12.6 Remove the `filter` `ThemeIcon` from `FocusSelectorTreeItem` so All Resources, views, and `CFN:` selectors render without icons (less visual noise); keep `add` icons on action rows
- [ ] 12.7 Verify in-editor: hide/reveal profiles persists across reload, "Show more regions" multi-select adds/removes, add/edit view works without the clone error, focus-selector rows have no icon, separators show no `…`

## 13. UX refinements (third round)

> Label convention: Title Case for all command/menu/selector labels (per VS Code's command-title guideline), e.g. `Select Profiles...`, `Select Regions...`, `Add View...`, `Edit View...`, `Remove View`, `View All Resources`.

- [x] 13.1 Rename the `All Resources` focus selectors to `View All Resources` (both the LocalStack Instances metamodel selector and the per-region selector)
- [x] 13.2 Move the Cloud Profiles action off the inline icon into the row's `...` overflow menu: contribute `localstack.manageProfiles` to `view/item/context` in a non-inline group keyed on `viewItem == localstackSection:profiles`, retitled `Select Profiles...`
- [x] 13.3 Move region management to the profile row's `...` menu: contribute `localstack.addRegion` to `view/item/context` (non-inline) keyed on `viewItem == localstackProfile`, titled `Select Regions...`; remove the `Show more regions` leaf node (`AddRegionTreeItem`) from `makeProfileChildren` and delete the now-unused class. The handler already reads `arg.profileName`, which a context menu supplies via the `ProfileTreeItem`
- [x] 13.4 Fix `Unable to write to Workspace Settings… no workspace is opened`: add a shared `configTarget()` = `workspace.workspaceFolders?.length ? Workspace : Global` and use it for all six `settings.ts` writes and the `multiSelect` toggle in `resource-browser.ts` (adaptive: per-workspace when a folder is open, global otherwise)
- [x] 13.5 Relabel the view actions in Title Case with the dialog `...` convention: `Add new view` → `Add View...`, `Edit view` → `Edit View...`, `Remove view` → `Remove View` (tree leaf label + command titles); also Title-case `Select Profiles...` (already) and `Select Regions...`
- [ ] 13.6 Verify in-editor: profile `...` menu shows `Select Profiles...`, profile-row `...` shows `Select Regions...`, both persist with no folder open (global) and with a folder open (workspace), and the `View All Resources` / `Add View...` labels render in Title Case

## 14. UX refinements (fourth round): all row actions in the `...` overflow

> Principle: tree rows carry no inline action icons; every per-row action lives in the row's `...` overflow menu (a non-inline `view/item/context` group, which VS Code also exposes on right-click). `Select Profiles...` and `Select Regions...` are already non-inline (round 3) and need no change beyond verification.

- [x] 14.1 Move `Edit View...` / `Remove View` off the inline toolbar: change their `view/item/context` entries on `localstackFilter` from `group: "inline@1"`/`"inline@2"` to a shared non-inline group (e.g. `1_modify@1`/`@2`) so they appear only in the `...` overflow; remove the `$(edit)`/`$(trash)` `icon` fields from the `editFilter`/`removeFilter` command definitions
- [x] 14.2 Move `Remove Region` off the inline toolbar: change its `view/item/context` entry on `localstackUserRegion` from `group: "inline"` to a non-inline group; remove the `$(trash)` `icon` from the `removeRegion` command definition
- [x] 14.3 Make `Add View...` an overflow item instead of a tree row: delete the `AddFilterTreeItem` leaf from `makeRegionChildren` in `viewProvider.ts` and delete the now-unused `AddFilterTreeItem` class from `treeItems.ts`; contribute `localstack.addFilter` to `view/item/context` (non-inline) keyed on the region rows (`viewItem == localstackDefaultRegion || viewItem == localstackUserRegion`), titled `Add View...`
- [x] 14.4 Adapt the `addFilter` handler to a context-menu invocation: the menu passes the `RegionTreeItem` as the argument, which already carries `profileName` and `regionId`, so read those off the item (keep the wizard unchanged)
- [ ] 14.5 Verify in-editor: no row shows an inline action icon; the region row `...` shows `Add View...` (and `Remove Region` on user-added regions); the view row `...` shows `Edit View...` / `Remove View`; `Select Profiles...` / `Select Regions...` appear in their `...` menus

## 15. ESLint typing cleanup (remove the ported-code exception)

> Goal: stop relaxing type-checked rules for ported AWS modules; fix the underlying code with real types rather than suppressing. Independent of Section 14 — the menu tweaks must not be blocked by this. No casting-to-silence: prefer typed SDK response shapes, zod parsing for dynamic JSON, and a typed `memoize` generic.

- [x] 15.1 Remove the per-file override block in `eslint.config.mjs` that turns off `@typescript-eslint/no-unsafe-{assignment,member-access,return,argument,call}`, `restrict-template-expressions`, and `no-base-to-string` for `src/platforms/aws/**`, `src/views/resources/**`, `src/views/resource-details/**`, and `src/utils/memoize.ts`
- [x] 15.2 Fix `src/utils/memoize.ts` (5): give the wrapper a typed generic signature (`<Args extends unknown[], Result>`) so it no longer returns/accepts `any`; cache holds `Awaited<Result>`
- [x] 15.3 Fix `src/platforms/aws/models/awsConfig.ts` (16): type the INI parse via `IIniObject`/`IIniObjectSection`, narrow section values (`typeof === "string"`), and type the caught error as `unknown` + `NodeJS.ErrnoException`
- [x] 15.4 Fix `src/platforms/aws/services/sqs/provider.ts` (23) and `src/platforms/aws/services/sns/provider.ts` (14): type the SDK responses at the client boundary — `getQueueAttributes` returns `GetQueueAttributesCommandOutput["Attributes"]`, `getTopicAttributes` returns `GetTopicAttributesCommandOutput`; coerce non-string SQS attribute defaults to strings
- [x] 15.5 Fix the remainder: `cloudformation.ts` `listStackResources` typed `StackResourceSummary[]` (also clears `cfnStackModel.ts:51`); `metamodelFocus.ts` payload typed `Record<string, unknown>` with explicit casts at the JSON-parse boundary; the 3 `src/views/resources/viewProvider.ts` hits were `require-await` warnings — resolved by returning the mapped arrays directly instead of `Promise.all` (which also avoids the `await-thenable` that typing exposed)
- [x] 15.6 Verify `pnpm lint` and `pnpm run check-types` pass with no remaining `no-unsafe-*` errors and the override block gone — confirmed: 0 eslint errors in `src/`, `tsc` clean

## 16. UX refinements (fifth round): restore inline icons (the `...` overflow does not render)

> Finding: a tree row's `...` overflow button only appears *alongside* an inline action. With Section 14's all-non-inline approach, the affected rows had no inline action, so VS Code rendered no hover toolbar and no `...` at all — the actions were reachable only by right-click. Reversing course: contribute the primary actions inline (with icons) so they are always visible, while keeping the non-inline entries so they remain in the right-click context menu.

- [x] 16.1 Set `icon` on the command definitions: `manageProfiles` → `$(edit)`, `addRegion` → `$(edit)`, `addFilter` → `$(add)`, `removeRegion` → `$(trash)`, `editFilter` → `$(edit)`, `removeFilter` → `$(trash)`
- [x] 16.2 Add inline `view/item/context` entries (keeping the existing non-inline ones) so each action shows an inline icon AND appears in the right-click menu: `manageProfiles` (group `inline`) on `localstackSection:profiles`; `addRegion` (group `inline`) on `localstackProfile`; `addFilter` (group `inline@1`) on the region rows; `removeRegion` (group `inline@2`) on `localstackUserRegion`; `editFilter` (group `inline@1`) and `removeFilter` (group `inline@2`) on `localstackFilter`
- [x] 16.3 Use a pencil (`$(edit)`) inline icon for `Select Profiles...` and `Select Regions...` (replacing the earlier `$(filter)`), and restore the pencil/trash inline icons on `Edit View...` / `Remove View`
- [ ] 16.4 Verify in-editor: the pencil icon shows on the Cloud Profiles and profile rows, the plus icon on region rows, the trash icon on user-added region rows, and pencil+trash on saved-view rows; each action is also present on right-click

## 17. UX refinements (sixth round)

- [x] 17.1 Gate instance children on running state: `makeInstanceChildren()` returns `[]` unless the emulator status is `running`; `InstanceTreeItem.setStatus()` also sets `collapsibleState` (`Expanded` when running, `None` otherwise) so a stopped instance renders as a plain line with no twistie; simplify `AppInspectorTreeItem` to drop the now-dead `isRunning` branch (always `Click to open` + open command, since it only renders when running)
- [x] 17.2 Use the gear/settings icon for the profile/region settings actions: in `package.json`, change `manageProfiles` and `addRegion` `icon` from `$(edit)` to `$(settings-gear)`
- [x] 17.3 Relabel view focus selectors as `View: <name>`: both `View All Resources` selectors (instance section + per-region) → `View: All Resources`; `FilterTreeItem` label → `View: ${filter.name}`; reserve the name `All Resources` (case-insensitive) in `runFilterWizard` `validateInput` with the error `"All Resources" is a reserved view name`; leave `CFN: <stack>` selectors unchanged
- [x] 17.4 Align focus-selector text with icon'd siblings (e.g. App Inspector): give `FocusSelectorTreeItem` a transparent `ThemeIcon("blank")` so its label occupies the post-icon column uniformly across the instance section, region View lines, and CFN lines
- [x] 17.5 Remove the section separators: drop the two `SeparatorTreeItem()` entries from the root `getChildren()` so only the three section nodes remain; delete the now-unused `SeparatorTreeItem` class and its import
- [ ] 17.6 Verify in-editor: stopped instance shows no children/twistie and flips to showing them live when started; gear icon on profile/region settings actions; `View: All Resources` / `View: <name>` labels; the View line aligns with `App`; no dash separators; a custom view cannot be named `All Resources`

## 18. UX refinements (seventh round)

> Source: in-editor feedback. Two prior ideas were explicitly **cancelled** and are NOT in scope: collapsing the Resources/Resource Details views by default, and auto-revealing a collapsed view on click (no API to detect collapse state; the only lever — `<viewId>.focus` — steals keyboard focus on every click).

- [x] 18.1 (#1) Blank icon by default: set `iconPath = new ThemeIcon("blank")` as a default in the base `LocalStackTreeItem` and `ResourceTreeItem` constructors (subclasses that assign a real icon after `super()` keep overriding). `SectionTreeItem` SHALL reset `iconPath = undefined` so the three top-level section headers sit flush with no icon column. Newly blanked rows: Explore regions/placeholders; Resources profile/region/service/type rows. Rows keeping their own icon: instance (`server-environment`), App Inspector (`search`), profile (`account`), ARN (service icon), error (`error`)
- [x] 18.2 (#2) Edit View icon → gear: in `package.json`, change `localstack.editFilter` `icon` from `$(edit)` to `$(settings-gear)` to match `Select Profiles...` / `Select Regions...` (gear since 17.2). (The on-screen "pencil" is the inline action button, not the row's icon, which already inherits `blank`.)
- [x] 18.3 (#3) Invert profile visibility to opt-in: replace the `localstack.cloudProfiles.hidden` model with `localstack.cloudProfiles.shown` (`string[]`). When **unset**, default to `["default"]`; if no profile named `default` exists, default to the first discovered profile name. `makeProfiles()` reads the shown set; `manageProfiles` ("Select Profiles...") pre-checks the shown set and persists the checked names via `setShownProfiles`. An **empty** shown set is honored (show nothing) — distinct from unset. Add `getShownProfiles`/`setShownProfiles` to `settings.ts`, remove `getHiddenProfiles`/`setHiddenProfiles`, and update the `onDidChangeConfiguration` key gate
- [x] 18.4 (#3) Empty-state placeholder: when the shown set is empty, `makeProfiles()` returns a single non-interactive `No profiles selected` placeholder (replacing the old `All profiles hidden`)
- [x] 18.5 (#6) Account-alias rendering: in `ResourceProfileTreeItem`, set `description` to `(${accountId} - ${accountName})` only when `accountName` is non-empty; otherwise `(${accountId})` (no trailing ` - `)
- [x] 18.6 (#7) Rename CloudFormation selector label: in `viewProvider.ts` `makeRegionChildren`, label stacks `Stack: <name>` instead of `CFN: <name>`
- [x] 18.7 (#8) Confirm destructive removals: `onRemoveRegion` and `onRemoveFilter` SHALL show a modal confirmation (`window.showWarningMessage(message, { modal: true }, "Remove")`) and proceed only when the user picks `Remove`
- [x] 18.8 (#9) Manual refresh buttons: add `localstack.refreshResources` and `localstack.refreshResourceDetails` commands (icon `$(refresh)`), contributed to `view/title` (`group: navigation`) gated on `view == localstack.resources` / `view == localstack.resourceDetails`; add a public `refresh()` to `ResourceViewProvider` and `ResourceDetailsViewProvider` that fires `onDidChangeTreeData` (re-fetching with the current focus / arn+profile); wire the two commands to the providers in `resource-browser.ts`
- [ ] 18.9 Verify in-editor: section headers sit flush (no icon) while other rows align under a blank icon column; `Edit View...` shows a gear; a fresh workspace shows only `AWS: default` (or the first profile when none is named `default`); deselecting every profile shows `No profiles selected`; a profile whose account alias is empty shows `(<id>)` with no trailing `-`; CloudFormation selectors read `Stack: <name>`; removing a region or a view prompts a modal confirm and cancelling aborts; the Resources and Resource Details views each show a refresh button that re-pulls data
