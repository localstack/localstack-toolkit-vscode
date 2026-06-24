## Why

The LocalStack Toolkit originally showed only a minimal "LocalStack" tree (instance status + an App Inspector launcher). This change builds a full resource-browsing experience into the Toolkit — a combined Explore tree, a Resources tree, and a Resource Details panel backed by AWS SDK service providers — so users get a single sidebar where they can browse the resources running in their local emulator *and* in their real AWS cloud profiles.

This is also the moment to generalize: the Toolkit is structured so that AWS is one *platform* among future (non-AWS) emulators, rather than hard-coding AWS throughout — and to make the browser reflect the **full published set of services LocalStack supports**, not just a hand-picked few.

## What Changes

### Combined Explore view and resource browser

- **Add three tree views** to the LocalStack activity-bar container: **Explore**, **Resources**, and **Resource Details**. The view is named "Explore" (not "LocalStack") to avoid duplicating the container title; first-open sizing is ~50% Resources, ~25% each for Explore and Resource Details.
- **Replace** the minimal LocalStack instances tree with the combined **Explore** tree of three sections:
  - **LocalStack Instances** → an instance node labeled `AWS (<Status>): <host:port>` (endpoint derived from the `localstack` profile's `endpoint_url`, status folded onto the line). When running it exposes `App Inspector`, a `View: All Resources` focus selector, and any saved instance views.
  - **Cloud Profiles** → one node per AWS profile from `~/.aws/config` (default-only until the user selects more) → the profile's default region plus user-added regions → `View: All Resources`, saved views, and one `Stack: <stack>` selector per CloudFormation stack.
  - **Workspace IaC** → a `Coming soon` placeholder.
- **Focus selectors** (`View: All Resources`, `View: <name>`, `Stack: <stack>`) drive the active Focus for the Resources view. Selection is **single-select**.
- **User-defined views** (`Add View...` / `Edit View...` / `Remove View`) scope a focus to a set of **service / resource-type pairs**, persisted in workspace settings; available under Cloud Profiles regions and under the LocalStack Instance node. **Dynamic regions** (`Select Regions...`) and **shown profiles** (`Select Profiles...`) are likewise persisted. Per-row actions appear as inline icons and in the right-click context menu.
- **Resource Details** renders as a self-contained, themed **webview table** of the selected resource's fields, fetched via the AWS SDK `describeResource` path (same code path for LocalStack and real AWS).
- **Relocate all AWS-specific code** under `src/platforms/aws/` (clients, services, models) so future emulators can add `src/platforms/<name>/`; the `Focus` model stays platform-neutral under `src/models/`.

### Full LocalStack service coverage (manifest + declarative providers)

- **Add a static service manifest** generated from LocalStack's published coverage data (`localstack-docs/src/data/coverage/*.json`, 117 services), keyed by AWS service code. It is the single source of truth for which services exist; the system SHALL NOT query a running emulator or any discovery API to decide what is supported.
- **Every supported service is a curated provider** — declaring its resource types, listing live resources, and describing a resource with a per-service field set. There is no generic/fallback provider tier and no Cloud Control listing.
- **Introduce a declarative provider format + engine** so curating ~117 services is tractable; the imperative `ServiceProvider` class remains as an escape hatch. **Completeness** (every manifest service has a provider) is the definition of done, enforced by a test, and delivered in **batches**.
- The metamodel "All Resources" view and CloudFormation stack listing both map emulator service labels to manifest ids and render every present service that has a curated provider.

### Target-aware icons (no AWS-derived art)

- **Remove all AWS-derived assets** (the hand-edited service SVGs) and the per-service `getIconPath` API.
- **Add a target-aware row icon**: the combined service-and-resource-type row shows `ThemeIcon("localstack-logo")` when its profile targets a LocalStack emulator and the built-in `ThemeIcon("cloud")` when it targets real AWS — both themed, neither AWS-derived. The target is resolved per profile from its `endpoint_url`.

## Capabilities

### New Capabilities
- `focus-model`: the Focus data structure is a fundamental part of this application, representing the mapping of (profiles → regions → services → resource types → ARNs). This data structure stores the set of resources that will be displayed in the resource view. There are many ways to create a `Focus` data structure, including direct querying of LocalStack's state, or examining the content of an existing CloudFormation stack.
- `localstack-explorer-view`: the combined "Explore" tree — its three sections, focus selectors, single-select behavior, user-added regions/views/shown-profiles persisted to workspace settings, and the inline/context row actions.
- `localstack-metamodel`: translating the emulator's pods-state metamodel endpoint into a Focus for the LocalStack Instances section (present services *and* present resource types only).
- `resource-browser`: the Resources and Resource Details views driven by the active focus, the target-aware row icon, and the AWS platform service providers that list and describe resources via the AWS SDK against a profile's endpoint.
- `service-catalog`: the static, coverage-derived service manifest; the requirement that every manifest service has a curated provider (no generic tier, no runtime discovery); and the declarative provider format/engine used to author them.

### Modified Capabilities
<!-- None: openspec/specs/ was empty before this change; this is the first set of specs. -->

## Impact

- **New views/commands/settings** in `package.json` (`contributes.views`, `commands`, `configuration`, `menus`, `icons`).
- **Replaces** `src/plugins/app-inspector-webview.ts`'s `InstancesTreeDataProvider` with the new Explore view; the App Inspector webview launcher is preserved.
- **New code** under `src/platforms/aws/` (clients, services, models, the service manifest + loader, the declarative engine and per-service definitions) and `src/views/` (localstack/resources/resource-details), following the Toolkit's conventions (kebab-case files, tab indentation, `node:`/`.ts` imports).
- **New dependencies**: `@aws-sdk/client-*` packages (the original nine plus the Batch 1 services), `js-ini`; bundled by the existing esbuild config. No new runtime dependencies for the icon or fix work.
- **Settings**: `localstack.cloudProfiles.{regions,filters,shown}` and `localstack.instanceViews`. The abandoned `localstack.focus.multiSelect` setting is removed; any stored value is ignored (behavior is single-select).
- **Tests**: model/view tests; metamodel→Focus translation, filter/region persistence, single-select `computeFocus`, region fallback, live filter resolution, instance-view metamodel intersection, manifest loading/label-mapping, declarative-engine execution, and per-service Batch 1 list/describe/CFN mapping. A completeness "done-gate" test tracks remaining service batches.
