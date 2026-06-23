## Context

The LocalStack Toolkit is a VS Code extension built with a small **plugin system** (`src/plugins.ts`): `extension.ts` constructs shared dependencies (status trackers, telemetry, output channel) and passes them as `PluginOptions` to each plugin's factory. Originally the only tree view, `localstack.instances`, was created inside the `app-inspector-webview` plugin and showed a single instance node with `Status` and `App Inspector` children. The build uses **esbuild** (extension, CJS, `external: ["vscode"]`) plus **Vite** (the App Inspector React webview). Tests run on **mocha + @vscode/test-cli**. Conventions: kebab-case filenames, **tab** indentation, `node:` import protocol, explicit `.ts` extensions, `import type`, object shorthand.

This change adds a full resource-browsing experience to that foundation: a combined `Explore` view, a `Resources` view, and a `Resource Details` view, backed by a `Focus` zod model, per-service `ServiceProvider`s, thin SDK client wrappers, and models for `ARN`, `awsConfig`, `cfnStackModel`, `regionModel`. AWS is structured as one *platform* (under `src/platforms/aws/`) so future non-AWS emulators can be added alongside it. On top of that foundation the change extends the browser to LocalStack's full published service set, uses target-aware (non-AWS-derived) iconography, and addresses a set of usability issues found during in-editor testing.

## Goals / Non-Goals

**Goals:**
- Three tree views in the LocalStack activity-bar container: **Explore** (combined), **Resources**, **Resource Details**, built as new code under the platform layout below.
- A combined Explore tree (Instances / Cloud Profiles / Workspace IaC) whose leaf "focus selectors" drive the Resources view; `All Resources` under Instances comes from the emulator metamodel, Cloud Profiles use wildcard focuses, and `Stack:` selectors use the CFN stack model.
- User-defined views (service/resource-type pairs) and dynamic per-profile regions and shown-profiles, persisted in workspace settings.
- All AWS code under `src/platforms/aws/` to allow future emulators; a platform-neutral `Focus` model under `src/models/`.
- Coverage of LocalStack's **full published service set**, every service a real curated provider, authored declaratively to be tractable, with no runtime discovery and no generic fallback.
- Service-and-resource-type rows carry a **target-aware** icon (LocalStack vs AWS) that bundles no AWS intellectual property.

**Non-Goals:**
- Workspace IaC functionality (placeholder `Coming soon` only) and non-AWS platforms (only the directory structure anticipates them).
- Parent/child **nesting** of resources or cross-resource **hyperlinks** — the tree stays flat; hyperlinks are deferred.
- Interactive Resource Details behaviors (ARN/log links, "open in editor").
- Multi-account support beyond the current single-account assumption.
- Restoring distinct per-service iconography (removed deliberately; could only return later as LocalStack's own original work).
- Landing all 117 providers in this change — it delivers the engine, the existing imperative providers, and Batch 1; later batches finish coverage.

## Decisions

### D1: One Explore tree provider with three sections

A single `LocalStackViewProvider` (`src/views/localstack/`) renders all three top-level sections; the Cloud Profiles section is where AWS profiles, regions, views, and CloudFormation stacks live. The existing instance affordances are preserved by reusing the `localStackStatusTracker` and `localstack.openAppInspector` command already passed through `PluginOptions`. The view is contributed as `localstack.instances` but **named "Explore"** to avoid duplicating the "LocalStack" container title; the three view contributions carry relative `size` weights (Resources `2`, the other two `1`) for ~50/25/25 on first layout.

### D2: The `Focus` model and the Resources / Resource Details views

The `Focus`/`ProfileFocus`/`RegionFocus`/`ServiceFocus`/`ResourceTypeFocus` zod types and the wildcard/`default` expansion logic implement the `focus-model` and `resource-browser` specs. The `Resources` and `Resource Details` views consume a `Focus` and render it: Resources expands the focus into the tree, Resource Details describes the selected resource.

### D3: Platform layout — `src/platforms/aws/`

```
src/platforms/aws/
  clients/    (account, cloudformation, dynamodb, iam, lambda, sfn, sns, sqs, sts, + Batch 1 clients)
  services/   (providerFactory, serviceProvider, declarative engine + definitions, service-manifest loader)
  models/     (arnModel, awsConfig, cfnStackModel, regionModel, metamodelFocus)
src/views/
  localstack/        (combined Explore view: provider + tree items + focus-selector logic + settings/commands)
  resources/         (Resources view)
  resource-details/  (Resource Details webview)
src/models/focus.ts  (platform-neutral Focus model)
```
`ProviderFactory` abstracts service lookup; a future emulator adds `src/platforms/<name>/`.

### D4: AWS SDK clients and LocalStack share one provider stack via `endpoint_url`

The `localstack` profile (written by the existing configure-aws plugin) sets `endpoint_url` to the emulator, so the *same* `ServiceProvider`s list/describe against LocalStack and against real AWS. Every client constructor goes through `AWSConfig.getClientConfig`, so the endpoint is always honored. (An early bug where six clients constructed `{ profile, region }` directly — causing "security token invalid" against real AWS — was fixed by routing all of them through `getClientConfig`.)

### D5: Single source of truth for the LocalStack endpoint

The instance node label, the metamodel fetch, and the LocalStack-profile SDK calls all use the `localstack` profile's `endpoint_url` from `~/.aws/config` (via a `getLocalStackEndpoint()` helper that falls back to the Toolkit's DNS-based default), rather than a hardcoded `localhost.localstack.cloud:4566`, which is wrong on DNS-rebind-protected machines.

### D6: LocalStack `All Resources` = metamodel-selected services/types + wildcard ARNs

The metamodel (`/_localstack/pods/state/metamodel`) is shaped `account → Service (PascalCase) → region → apiOperation → rawResponse` (see the captured `metamodel-sample.json`) — a transpose of the Focus shape. `metamodelFocus.ts` fetches it (lenient parse — the payload can contain raw control characters), filters to account `000000000000`, maps each PascalCase label to a manifest service id (`toLowerCase()` plus an override table, e.g. Step Functions → `states`), dedups the `""` global-region mirror, and emits a Focus naming the present services. **Resource ARNs are left as wildcards** so the SDK providers list live resources on drill-down; Resource Details always uses the SDK `describeResource` path, never the metamodel's captured fields. A present service with no registered provider is omitted and logged.

The focus also names only the **present resource types**, not every registered type of a present service: each resource type maps to the metamodel list operation that signals its presence (e.g. SSM `describeParameters` → Parameters), and only types whose operation key appears are included. If an operation maps to no known type (or a type declares no op), the service's full type set is included and the gap is logged, so a mapping gap never hides resources.

### D7: Settings persistence

Workspace-scoped configuration keys (falling back to Global when no folder is open, via a shared `configTarget()` so writes never fail with "no workspace is opened"):
- `localstack.cloudProfiles.regions`: `profileName → string[]` of added regions.
- `localstack.cloudProfiles.filters`: `profileName → [{ name, resources: { service, resourceType }[], scope }]`, where `scope` is `{ region }` or `{ allRegions: true }`.
- `localstack.cloudProfiles.shown`: `string[]` of shown profiles (opt-in; unset ⇒ `["default"]`, or the first profile when none is named `default`; an empty set is honored).
- `localstack.instanceViews`: instance views, stored under a **dedicated** key (not the `cloudProfiles.filters` map) to avoid colliding with the bundled `localstack` cloud profile's region views; the `SavedFilter` type is reused with a placeholder scope that instance rendering ignores.

The view refreshes on `onDidChangeConfiguration` for these keys.

### D8: Single-select focus selectors

The view is **single-select**: activating one focus selector deactivates any other, and `computeFocus` returns the single selected selector's focus (`undefined` when nothing focusable is selected). The tree view is registered once with `canSelectMany: false`. (An earlier multi-select design — a `localstack.focus.multiSelect` setting toggled from the view title menu, re-registering the tree view to flip `canSelectMany`, with focuses merged via `mergeFocuses` — proved unreliable and was removed entirely, including the setting, the enable/disable commands, the `localstack.multiSelect` context key, and `mergeFocuses`. It may be rethought and reintroduced later.)

### D9: Add/Edit/Remove views and regions via native VS Code primitives

VS Code cannot show a custom multi-field modal without a webview, so these flows compose `showInputBox`/`showQuickPick`/`createQuickPick`. **Views** use a wizard: name (validated unique within the profile/instance, and `All Resources` reserved case-insensitively), then a multi-select of **service / resource-type pairs** (label `"<Service> — <Plural Type>"`), then — for Cloud Profiles regions only — a region scope (`This region only` / `All regions in this profile`). The instance entry point omits the scope step. Views are editable (re-run the wizard pre-populated) and removable (modal confirmation). **Regions** are managed by a single `Select Regions...` multi-select that replaces the user-added set in one action; the configured default region is always shown and never removable. **Shown profiles** are managed by `Select Profiles...`.

### D10: Row actions are inline icons *and* context-menu items

A tree row's `...` overflow only renders alongside an inline action, so each per-row action is contributed both as an inline `view/item/context` entry (with an icon) and as a non-inline entry (right-click menu). Final inline icons: a pencil for `Select Profiles...` / `Select Regions...` / `Edit View...`, a plus for `Add View...`, and a trash for `Remove Region` / `Remove View`. (This reverses an interim "everything in the `...` overflow" attempt that left rows with no visible toolbar.) Focus-selector rows carry a transparent `blank` icon so the instance's `View: All Resources` aligns under `App Inspector`; this is the only use of `blank` — other iconless rows render with no icon column.

### D11: Merged service + resource-type row; Resource Details as a webview table

The Resources tree fuses the service and resource-type levels into one `ResourceServiceTypeTreeItem` (`label` = service name, dimmed `description` = plural type), so a multi-type service renders one row per type and ARN leaves carry no icon. Resource Details is a `WebviewViewProvider` rendering a self-contained, CSP-locked, theme-variable-styled key/value table, formatting values per `FieldType` (`JSON` pretty-printed, `LONG_TEXT` wrapped, `ARN`/`LOG_GROUP` monospace, others plain), with HTML-escaped values; interactions (links, open-in-editor) are deferred. The field column is capped at `table-layout: fixed; width: 33%` with `overflow-wrap: break-word`, so a long label wraps instead of consuming the row.

### D12: Target-aware row icon, not a service icon

The row icon denotes the profile **target**, not the service: `ThemeIcon("localstack-logo")` for a LocalStack-targeted profile, the built-in `ThemeIcon("cloud")` for AWS. `isLocalStack` is resolved once per profile in `makeResourceProfiles` — true when the profile resolves to a custom/local `endpoint_url` or is the synthetic `localstack` instance profile — stored on `ResourceProfileTreeItem`, and read by the row via its parent chain. `ServiceProvider.getIconPath` and the 6 AWS-derived SVGs are deleted; `ServiceProvider` returns to being purely about resource data. Trade-off: a profile pointed at a non-LocalStack custom endpoint would also get the LocalStack mark — accepted as a rare edge case, refinable later by host-pattern matching.

### D13: Static service manifest as the single source of truth

`resources/service-manifest.json` (bundled) + a loader under `src/platforms/aws/services/`. A checked-in generator reads `localstack-docs/src/data/coverage/*.json` and emits one `{ id, name }` per service, where `id` is **AWS's own service code** (e.g. `s3`, `secretsmanager`, `cognito-idp`, `logs`, `events`, `states`). Every service is included regardless of community/pro availability, and availability is neither stored nor displayed (the browser also targets real AWS, so all services are treated as fully available). Regeneration is **on-demand only**. The supported set is never discovered from a running service (`/_localstack/health`, Cloud Control, scraping) — the published list is the contract, and cloud profiles have no such endpoint anyway.

### D14: Every service is curated — no generic tier — via a declarative engine

`ProviderFactory` registers a curated provider per manifest service; there is no generic/Cloud-Control fallback (a service with no provider is simply absent during rollout). A **completeness test** asserts every manifest id has a provider — green is the definition of done. To make ~117 services tractable, a service is authored as data:

```
defineService("s3", "S3", {
  bucket: {
    singular: "Bucket", plural: "Buckets",
    list: c => c.listBuckets().Buckets, id: b => b.Name,
    cfn: "AWS::S3::Bucket", detailFrom: "self",
    detail: [ { label: "Name", path: "Name", type: NAME }, ... ],
    metamodelOp: "listBuckets",
  },
})
```

A shared engine adapts a definition to the `ServiceProvider` interface (resource types, `getResourceArns`, `describeResource` by walking each field's `path`, CFN mapping, and the op→type map for D6). The imperative `ServiceProvider` class stays as the **escape hatch** for services that can't be expressed declaratively. Resource types are an editorial curation layer (coverage data has operations, not resource types); CFN type names are taken from existing knowledge, committed once, not verified against live CFN. Listing/detail use per-service SDK `List*`/`Describe*` calls through `getClientConfig`; identifiers are the ARN where available, else the primary id (the leaf tolerates a non-ARN identifier).

### D15: Detail fields are generated by importance, then refined

Detail-field selection is a build-time authoring aid: a dev-time generator reads each resource type's Describe/Get (or list-item) shape from **offline** AWS API models (`aws-sdk` v2 `apis/*.normal.json` or botocore `service-2.json` — generator-only, never bundled), ranks members by importance (identifiers/names → status → type → timestamps → scalars; nested collapsed/dropped; metadata/pagination/blobs excluded; capped ~12), maps each to a `FieldType`, and emits the `detail` data spec into the committed definition. At runtime the view renders that committed, typed subset — not the raw response. Multi-call or list-only services get a partial first cut and are hand-finished.

### D16: CloudFormation stack listing maps curated resources

`cfnStackModel` queries a stack's resources and groups them by service/resource type. A resource is shown when its service maps to a registered curated provider; it is skipped (and logged) only when unrepresentable — its service is not yet curated, or a required identifying field is absent — rather than aborting the whole stack.

### D17: Region fallback in `getClientConfig`

When `getClientConfig(profile, region)` receives an empty/undefined region, it falls back to `getRegionForProfile(profile)` then `us-east-1`. This single choke point fixes describe for region-less ARNs (S3 `arn:aws:s3:::name`, IAM) without threading a focus region through every provider signature; listing is unaffected because it always passes the focus region.

### D18: Live filter resolution + command-driven refresh

Saved-view focus producers resolve their definition live by (profile, name) from settings at selection/refresh time, rather than capturing a `SavedFilter` snapshot at tree-build time. The add/edit/remove command handlers refresh the Resources view after mutating settings (the `ResourceViewProvider` is threaded into `registerLocalStackCommands`). So editing the active view reflects immediately; removing it makes the live lookup yield nothing and the Resources view reverts to its placeholder.

### D19: Instance views intersect the live metamodel

An instance view's focus is computed by intersecting the live metamodel: `computeMetamodelFocus(endpoint)` kept to only the chosen `{ service, resourceType }` pairs. This keeps instance views consistent with the instance's `View: All Resources` and never lists a type with nothing deployed. (Correctness depends on D6 naming only present resource types.)

### D20: Build, dependencies, testing

esbuild bundles the AWS SDK with `external: ["vscode"]`; only used clients are imported. Dependencies: `@aws-sdk/client-{account,cloudformation,dynamodb,iam,lambda,sfn,sns,sqs,sts}` + the Batch 1 service clients (pinned `3.901.0`) + `js-ini`; `zod` already present. The mocha test suite covers: metamodel→Focus translation (fixture-based), single-select `computeFocus`, region fallback, live filter resolution, instance-view metamodel intersection, manifest loading/label-mapping, declarative-engine execution, and per-service Batch 1 list/describe/CFN mapping. A skipped "done-gate" completeness test tracks remaining service batches.

## Risks / Trade-offs

- **Metamodel payload shape / label set** → a real payload is captured and decoded; the label→id map lives in one place and is fixture-tested. Raw control characters in the JSON are handled by a lenient parse.
- **Multi-account metamodels** → v1 filters to account `000000000000` (consistent with one-account-per-profile Cloud Profiles); revisit if multi-account emulator state becomes a real need.
- **Step Functions metamodel label** → Step Functions is not currently returned by the metamodel (a known emulator bug); a best-guess `→ states` override is carried but treated as unverified.
- **Misclassifying a non-LocalStack custom endpoint as LocalStack** → accepted edge case; refinable by host-pattern matching.
- **Scale & maintenance of 117 services × fields** → declarative definitions + the D15 generator minimize hand-work; batched delivery keeps each increment reviewable; the completeness test prevents silent gaps; a test that curated ids match manifest ids guards drift.
- **Auto-selected fields may mis-rank** → accepted; fields are committed and editable. Declarative-engine expressiveness gaps are covered by the imperative escape hatch; parity of the migrated providers is diff-tested before removing imperative versions.
- **Wrong default region for a genuinely regional region-less ARN** → only affects effectively-global resources (S3, IAM); the profile default is sensible and far better than failing.
- **Over-refreshing the Resources view on any view mutation** → cheap re-list; non-active views recompute to the same focus. Renaming the active view orphans it (reverts to placeholder) — accepted.

## Migration Plan

Additive on an unreleased branch; no runtime data migration. Order: build the Focus model and AWS platform code → build the combined Explore view, metamodel focus, settings, and view wiring → UX refinements from in-editor feedback → declarative engine + manifest + completeness test + Batch 1 → target-aware icons → browser fixes (region fallback, details column, remove multi-select, live filter resolution, metamodel resource-type accuracy, instance views). Rollback is reverting the branch. An earlier iteration shipped an opt-in multi-select that proved unreliable and was removed before release (D8); the `localstack.focus.multiSelect` setting is ignored if present. Existing `Status`/`App Inspector` affordances and the `localstack.cli.location` setting are untouched. Subsequent service batches and the parity migration of the imperative providers continue until the completeness test is green.

## Open Questions

Resolved during the work: Vision 1 (metamodel selects, SDK lists) over a generic metamodel data-source provider; Resource Details always via the SDK; single account for v1; show the bundled `localstack` profile in Cloud Profiles; per-profile/per-region view scope with an "all regions" option; no live-CFN verification; on-demand manifest regeneration; availability neither stored nor shown; detail fields generated-then-refined; not-yet-curated services are simply absent.

Carried for later: refine the LocalStack signal to host-pattern matching; confirm the Step Functions metamodel label once the emulator emits it; whether the metamodel ever records an operation with an empty result (would need a "response non-empty" presence test instead of operation-key-present); whether any resource type is listed via multiple operations (the sample is 1:1).
