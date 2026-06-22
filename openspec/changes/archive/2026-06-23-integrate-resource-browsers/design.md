## Context

The LocalStack Toolkit is a VS Code extension built with a small **plugin system** (`src/plugins.ts`): `extension.ts` constructs shared dependencies (status trackers, telemetry, output channel) and passes them as `PluginOptions` to each plugin's factory. Today the only tree view, `localstack.instances`, is created inside the `app-inspector-webview` plugin by `InstancesTreeDataProvider` and shows a single instance node with `Status` and `App Inspector` children. The build uses **esbuild** (extension, CJS, `external: ["vscode"]`) plus **Vite** (the App Inspector React webview). Tests run on **mocha + @vscode/test-cli**. Conventions: kebab-case filenames, **tab** indentation, `node:` import protocol, explicit `.ts` extensions, `import type`, object shorthand.

The **AWS Inspector** extension (cloned for reference) implements the target experience in ~3700 LOC: a `Focus` view, a `Resources` view, and a `Resource Details` view, backed by a `Focus` zod model, per-service `ServiceProvider`s, thin `awsClients/*` SDK wrappers, and models for `ARN`, `awsConfig`, `cfnStackModel`, `regionModel`. Its `extension.ts` wires `focus → resources → resource-details` selection events. It depends on nine `@aws-sdk/client-*` packages, `js-ini`, and `zod`.

This change merges AWS Inspector into the Toolkit, **reorganizing** its single "Focus" view into the Toolkit's richer "LocalStack" tree, and generalizing AWS into one *platform*.

## Goals / Non-Goals

**Goals:**
- Three tree views in the existing LocalStack activity-bar container: **LocalStack** (combined), **Resources**, **Resource Details**.
- Reuse AWS Inspector's `Resources`, `Resource Details`, `ServiceProvider`, model, and client code as-is wherever possible — relocated and re-styled to Toolkit conventions, not rewritten.
- A new combined "LocalStack" tree (Instances / Cloud Profiles / Workspace IaC) whose leaf "focus selectors" drive the Resources view.
- `All Resources` under Instances computed from the emulator metamodel; `All Resources`/filters under Cloud Profiles use wildcard focuses; `CFN:` selectors use the CFN stack model.
- User-defined filters and dynamic per-profile regions persisted in workspace settings.
- Single-select by default; opt-in multi-select that merges focuses.
- All AWS code under `src/platforms/aws/` to allow future emulators.

**Non-Goals:**
- Workspace IaC functionality (placeholder `Coming soon` only).
- Non-AWS platforms (only the directory structure anticipates them).
- Changing the App Inspector webview, setup wizard, status bar, logs, or configure-aws plugins beyond what wiring requires.
- New AWS services beyond those AWS Inspector already supports.

## Decisions

### D1: One "LocalStack" tree provider replaces `InstancesTreeDataProvider`; the Focus view is absorbed, not ported as a separate view

AWS Inspector's `FocusViewProvider` becomes the *Cloud Profiles* portion of a new `LocalStackViewProvider` (`src/views/localstack/`). Its top-level nodes are the three sections in the proposal. The existing instance node (`Status`, `App Inspector`) is preserved by reusing the `localStackStatusTracker` and `localstack.openAppInspector` command already passed through `PluginOptions`. **Alternative considered:** keep a separate "Focus" view as in AWS Inspector — rejected because the instructions explicitly fold Focus into the LocalStack view and define a different node hierarchy (regions nested under profiles, CFN under regions rather than a separate top-level).

### D2: Reuse AWS Inspector's `Focus` zod model and view providers verbatim where possible

`Resources` and `Resource Details` views are "untouched functionality" per the instructions. We port `src/views/resourcesView/*`, `src/views/resourceDetailsView/*`, `src/models/focusModel.ts`, and `src/services/*` with minimal edits — chiefly import-path/convention fixes and relocation. The `Focus`/`ProfileFocus`/`RegionFocus`/`ServiceFocus`/`ResourceTypeFocus` types and the wildcard/`default` expansion logic in `resourcesView` already implement the `focus-model` spec.

### D3: Platform layout — `src/platforms/aws/`

```
src/platforms/aws/
  clients/        (← awsClients/*: account, cloudformation, dynamodb, iam, lambda, sns, sqs, states, sts)
  services/       (← services/*: providerFactory, serviceProvider, <service>/provider)
  models/         (← models/*: arnModel, awsConfig, cfnStackModel, regionModel)
src/views/
  localstack/     (new combined view: provider + tree items + focus-selector logic)
  resources/      (← resourcesView)
  resource-details/ (← resourceDetailsView)
src/models/focus.ts   (platform-neutral Focus model + merge)
```
`ProviderFactory` already abstracts service lookup; a future emulator adds `src/platforms/<name>/`. The `Focus` model is platform-neutral and stays under `src/models/`. **Alternative:** flat `src/aws/` — rejected for weaker future-proofing (the chosen option matches the instruction to anticipate non-AWS emulators).

### D4: AWS SDK clients and LocalStack share one provider stack via `endpoint_url`

The `localstack` profile (written by the existing configure-aws plugin) already sets `endpoint_url` to the emulator. AWS Inspector's `awsConfig.getClientConfig()` returns `{ profile, region, endpoint }`, so the *same* `ServiceProvider`s list/describe against LocalStack when the LocalStack profile/endpoint is used. This is what makes "metamodel selects, SDK lists" (D5) cheap. We will standardize all client constructors to go through `getClientConfig` (today `cloudformation.ts` constructs `new CloudFormationClient({ profile, region })` directly — it will use `getClientConfig` so the endpoint is honored).

### D5: LocalStack `All Resources` = metamodel-selected services + wildcard ARNs (Vision 1 now, Vision 2 fast-follow)

**Decoded metamodel shape** (from the captured `metamodel-sample.json`):

```
{ <accountId>: { <ServiceLabel>: { <region>: { <apiOperation>: <rawApiResponse> } } } }
```

i.e. **account → Service (PascalCase) → region → operation → response**. This is a *transpose* of the Focus shape (which is profile → region → service → resourcetype → arns): the Service and region axes are swapped, there is an extra `account` level on top and an `operation` level in the middle, and the leaf is a full API response object rather than an ARN list.

A new `src/platforms/aws/models/metamodelFocus.ts` fetches `/_localstack/pods/state/metamodel` and builds a `Focus` whose profile is the LocalStack profile, whose regions/services are those *present* in the metamodel (after mapping the PascalCase label to a provider id and filtering to supported services), and whose resource-type/ARN selectors are wildcards. Rendering then reuses the standard wildcard expansion in the Resources view to list live resources via the SDK against the LocalStack endpoint.

Translation rules:
- **Service label → provider id**: empirically (live sample), `label.toLowerCase()` yields the correct provider id for every supported service *except* Step Functions. Confirmed: `CloudFormation→cloudformation`, `IAM→iam`, `SNS→sns`, `DynamoDB→dynamodb`, `SQS→sqs`, `Lambda→lambda`. The rule is therefore `toLowerCase()` plus a small override map for exceptions — currently just Step Functions (`<label>→states`; its label, likely `StepFunctions`, was not present in any captured sample and must be confirmed). Non-obvious labels for *unsupported* services (`CloudWatchLogs→logs`, `EventBridge→events`) only matter if/when those providers are added. Services with no `ServiceProvider` are dropped (see R-cov below); live samples show this drops at least `CloudWatch`, `CloudWatchLogs`, `EventBridge`, `S3`, `SSM`.
- **Resource types**: for each selected service, emit every `provider.getResourceTypes()` with `arns: ["*"]` (the `resourcesView` only expands resource-type wildcards inside its service-wildcard branch, so the translator must enumerate them explicitly rather than emit a `"*"` resourcetype).
- **Global / `""` region**: IAM appears under both `us-east-1` and `""` (the global mirror) with identical contents — dedup by skipping `""`, but keep a global service that appears *only* under `""`.
- **Account**: assume a single account (`000000000000`) maps to the one LocalStack profile; multi-account is out of scope for v1 (see Open Questions). NOTE: a live sample confirmed a second account (`949334387222`) *does* appear in practice — harmless today (it only held S3, which has no provider) but the assumption will hide supported-service resources in any non-default account. Filter the metamodel to the `000000000000` account explicitly so this is a known, deliberate omission rather than accidental.

**Why Vision 1 (selector) over Vision 2 (data source) for v1.** The sample shows the metamodel already contains the resources themselves (`BucketArn`, `Roles[].Arn`, `StackSummaries[].StackId`, full field sets), so a generic `MetamodelServiceProvider` could render *all* present services directly from the JSON — including ones with no bespoke provider — and populate Resource Details from the captured fields with no SDK call (**Vision 2**). That is strictly broader, but it is a second rendering path and the response data is irregular (varying collection keys and ARN field names; some resources, e.g. SSM `Parameters`, have *no* ARN field at all). For v1 we keep the single shared provider path (Vision 1) and accept the supported-service ceiling — it is acceptable to omit metamodel services that have no provider; Vision 2 is deferred to a future change. **Alternative rejected:** translate the entire metamodel into a concrete-ARN focus *without* a generic provider — pointless, because the Resources/Resource Details views still need a `ServiceProvider` per service for names, icons, and describe, so unsupported services could not be shown anyway.

### D6: Persistence in workspace settings

Two new configuration keys (workspace scope):
- `localstack.cloudProfiles.regions`: map of `profileName → string[]` of added regions.
- `localstack.cloudProfiles.filters`: map of `profileName → [{ name, services: string[], scope }]`, where `scope` is either `{ region: "<regionId>" }` (the filter shows under that one region) or `{ allRegions: true }` (the filter shows under every region of the profile). When rendering region *R* of profile *P*, the view shows every filter of *P* whose scope is `allRegions` or whose `region === R`.

Read/written via `vscode.workspace.getConfiguration`. The view refreshes (`onDidChangeTreeData`) on `onDidChangeConfiguration`. **Alternative:** `ExtensionContext.workspaceState` — rejected because the instruction specifies VS Code *settings* for the current workspace (visible/editable in settings.json).

### D7: Multi-select

Multi-select state persists in the workspace setting `localstack.focus.multiSelect` (default `false`), but the **affordance lives in the view itself, not the Settings UI**: a toggle command in the LocalStack view's title menu (the `...` overflow), contributed via `contributes.menus` → `view/title` with `when: view == localstack.instances`. The command flips the setting.

`createTreeView(..., { canSelectMany })` is fixed at registration, so toggling **re-registers the tree view in place** — dispose the existing `TreeView` and recreate it with the new `canSelectMany`, restoring the prior selection/focus where possible. Because the toggle is a deliberate in-view action (not an arbitrary settings edit), re-registering on toggle is seamless and needs no reload prompt.

Current state is reflected with the two-command + context-key pattern: a `localstack.multiSelect` context key (set via `setContext`) gates which command appears — "Enable multi-select" when off, "Disable multi-select" when on — so the menu always shows the action that applies.

The active selection set is tracked in the `LocalStackViewProvider`; on selection change it computes each selector's `Focus` and, when multiple, merges them via the `focus-model` merge function before calling `resourcesView.setFocus`. AWS Inspector already left a `TODO: canSelectMany` hook and a single-selection `getFocusFromSelection`; we extend it to a set + merge.

### D8: Dependencies and build

Add `@aws-sdk/client-{account,cloudformation,dynamodb,iam,lambda,sfn,sns,sqs,sts}` and `js-ini`. esbuild already bundles node CJS with `external:["vscode"]`; the AWS SDK bundles fine this way (AWS Inspector uses the same esbuild setup). No Vite change. `zod` is already a Toolkit dependency.

### D9: Testing

Port AWS Inspector's mocha tests (`models/*`, `views/*`, fixtures under `test/resources/*.focus.json`) into the Toolkit's `src/test/` tree and `@vscode/test-cli` runner. Add new tests for: metamodel→Focus translation (with a captured sample payload), focus merge, and filter/region settings persistence.

### D10: Add/Edit/Remove UX for filters and regions (native VS Code primitives)

VS Code extensions cannot show a custom multi-field modal without a webview, so these flows compose the native primitives (`showInputBox`, `showQuickPick`, `createQuickPick`) rather than a webview. A webview form was considered and rejected as over-engineering for small dialogs (the toolkit's only webview is the App Inspector React app).

**Filters** use a 3-step wizard (Option A) launched from the `Add new filter` node's command (`localstack.addFilter`, invoked with `{ profile, region }`):
1. `showInputBox` — filter name, validated live for non-empty + uniqueness **within the profile** (an `allRegions` filter spans regions, so per-profile uniqueness avoids ambiguity).
2. `showQuickPick({ canPickMany: true })` — supported services from `ProviderFactory.getSupportedServices()` (alphabetized, display names; ≥1 required). Only supported services are offered, since unsupported ones can't render.
3. `showQuickPick` (single) — scope: `This region only` (default) or `All regions in this profile`, persisted as the `scope` shape from D6.

Filters are **editable and removable**: `Edit filter` re-runs the same wizard pre-populated with the current name/services/scope and overwrites the entry; `Remove filter` deletes it. Both are context-menu (`view/item/context`) actions keyed on the filter tree item's `contextValue`, with inline hover icons. Without these, filters would be write-once.

**Regions** are simpler — one region per add, single removal:
- `Add new region` — a single-select `showQuickPick` of regions not already shown for the profile; persisted to `localstack.cloudProfiles.regions`.
- `Remove region` — a context-menu action on a *user-added* region node that removes that one region. The profile's **configured default region is always shown and offers no Remove action** (it comes from `~/.aws/config`, not our settings).

**Alternatives considered:** (B) folding filter scope into a quick-pick title-bar toggle button — rejected for poor discoverability; (C) a webview form — rejected as disproportionate. Back-navigation between wizard steps is a nice-to-have via `createQuickPick` buttons, not required for v1.

### D11: Single source of truth for the LocalStack endpoint

The LocalStack instance node label, the metamodel fetch (D5), and the SDK providers for the LocalStack profile (D4) MUST all use the same endpoint. That endpoint is **the `localstack` profile's `endpoint_url` in `~/.aws/config`**, which the existing `configure-aws` plugin writes based on a DNS check (`http://localhost.localstack.cloud:4566` when `test.localhost.localstack.cloud` resolves to `127.0.0.1`, else `http://127.0.0.1:4566`). The current tree hardcodes `localhost.localstack.cloud:4566`, which is wrong on DNS-rebind-protected machines; the new view derives the host:port from the configured `endpoint_url` instead.

Implementation: extract a small helper (e.g. `getLocalStackEndpoint()`) that reads the `localstack` profile's `endpoint_url` (reusing the existing INI utilities), falling back to the Toolkit's own default logic (the same DNS check) when the profile is not yet configured. The metamodel fetch uses this helper rather than a literal URL. (Note: `manage.ts` currently hardcodes `127.0.0.1:4566` for health/info — out of scope to refactor here, but the helper is the natural future home for it.) **Alternative:** keep re-running the DNS check at render time — rejected because the profile's `endpoint_url` is the value actually used by every SDK call, so reading it guarantees the label and the data agree.

## Risks / Trade-offs

- **Metamodel payload shape** → Resolved: a real payload is captured in `metamodel-sample.json` and decoded in D5. Remaining unknown is the exact set of PascalCase service labels LocalStack emits — mitigate by gathering more samples and keeping the label→provider-id map in one place. Cover the translator with a fixture-based test.
- **[R-cov] Supported-service ceiling** → The metamodel reports more services than we have providers for (sample: S3, EventBridge, SSM have none). With Vision 1, those services are dropped from LocalStack "All Resources" → Mitigation: log/note dropped services; deliver Vision 2 (generic metamodel provider) as fast-follow to lift the ceiling.
- **Irregular response data** (varying collection keys, ARN field names; SSM `Parameters` have no ARN; `Owner`/`IsTruncated`/`NextToken` noise keys; `""` global region duplicates) → Mitigation: Vision 1 sidesteps this entirely (it only reads service/region presence, not the payloads); these only matter when Vision 2 lands, where per-operation extraction must be table-driven and tolerant of missing ARNs.
- **Metamodel JSON contains raw control characters** inside string values → strict `JSON.parse` throws (confirmed against the live endpoint). Mitigation: sanitize/escape control characters before parsing (or parse leniently); cover with a test using a payload that includes them.
- **The `localstack` profile may also appear in the Cloud Profiles list** (it is a normal `~/.aws/config` profile), duplicating the LocalStack Instances section → Mitigation: decide a single rule in implementation (e.g. exclude the bundled `localstack` profile from Cloud Profiles, or allow it) and document it; default to excluding it.
- **AWS SDK adds ~nine packages to the bundle** → Mitigation: tree-shaking + esbuild minify in production builds; only the used clients are imported. Acceptable given AWS Inspector already shipped this way.
- **Multi-select requires view re-registration when toggled** → Mitigation: gate behind a setting and show a "reload to apply" notice; avoids fighting the immutable `canSelectMany` option.
- **Convention drift while porting** (AWS Inspector uses spaces, no `node:`/`.ts` import rules) → Mitigation: run `pnpm lint` + `biome check` as a porting checklist step; the eslint config will flag violations.
- **`endpoint_url` resolution differences across AWS SDK versions** → Mitigation: route every client through `getClientConfig`, and verify against the running emulator during the verification task.

## Migration Plan

This is additive to an unreleased branch (`integrate-resource-browsers`); no runtime data migration. Rollout is the normal extension release. Rollback = revert the branch. The only user-visible replacement is the LocalStack tree's contents; existing `Status`/`App Inspector` affordances are preserved, and existing settings (`localstack.cli.location`) are untouched.

## Open Questions

- **Vision 1 vs Vision 2 for v1** — RESOLVED: Vision 1. It is acceptable for v1 to omit metamodel services that have no registered provider (e.g. S3, EventBridge, SSM). Vision 2 (generic metamodel provider, broader coverage) is deferred to a future change, not a fast-follow commitment.
- **Resource Details source for LocalStack resources** — RESOLVED: always use the SDK `describeResource` path, never the metamodel's captured fields. This keeps Resource Details identical whether the resource lives in LocalStack (SDK against the `endpoint_url`) or real AWS cloud. Even if Vision 2 later renders the Resources *tree* from the metamodel, Resource Details stays on the SDK.
- **Multi-account metamodels** — RESOLVED for v1: assume the single account `000000000000`. This is consistent with Cloud Profiles, where each AWS profile surfaces exactly one account. (Live data confirms a second account *can* appear; v1 deliberately filters to `000000000000`. Revisit if multi-account emulator state becomes a real need.)
- **Step Functions service label** — cannot be confirmed yet: Step Functions is **not returned by the metamodel endpoint at all** (a known emulator bug, to be fixed later). Consequently Step Functions resources will not appear in LocalStack "All Resources" until the emulator is fixed, regardless of our mapping. Carry a best-guess override (`StepFunctions→states`) but treat it as unverified; confirm and finalize once the emulator emits Step Functions state. Every other supported service maps via `toLowerCase()`.
- **Show the bundled `localstack` profile in Cloud Profiles** — RESOLVED: yes, show it (do not hide it). The LocalStack Instances section and the `localstack` profile under Cloud Profiles coexist.
- **Filter scope** — RESOLVED: filters are per-profile *and* per-region (each region has its own set), but the "Add new filter" dialog offers an **"apply to all regions"** option that makes the filter available under every region of that profile. See D6 for the persisted `scope` shape.
