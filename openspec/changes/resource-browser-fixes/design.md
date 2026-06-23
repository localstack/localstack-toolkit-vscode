## Context

Five issues in the resource browser / LocalStack view, grounded in the current code:

- **#1 S3 region.** S3 bucket ARNs are region-less (`s3.ts` emits `arn:aws:s3:::name`). Listing uses the focus region, but `DeclarativeServiceProvider.describeResource` builds its client with `arn.region` ([engine.ts:137](../../../src/platforms/aws/services/declarative/engine.ts)), which is empty → "Region is missing". The details view also drops the focus region, passing only `setArn(profile, arn)` ([resource-browser.ts:48](../../../src/plugins/resource-browser.ts)).
- **#2 Details column.** The details webview sets `td.field { white-space: nowrap; width: 1% }` ([resource-details/viewProvider.ts:52](../../../src/views/resource-details/viewProvider.ts)); `nowrap` lets a long label consume the row.
- **#3 Multi-select.** A `localstack.focus.multiSelect` setting drives `canSelectMany` via tree-view re-registration (`createLocalStackView`/`recreateLocalStackView`/`setMultiSelect` in `resource-browser.ts`), `computeFocus` merges via `mergeFocuses` ([localstack/viewProvider.ts:117](../../../src/views/localstack/viewProvider.ts), [focus.ts:147](../../../src/models/focus.ts)).
- **#4 Edit-view refresh.** The Resources view holds a `focusProducer` closure ([resources/viewProvider.ts:53](../../../src/views/resources/viewProvider.ts)) capturing a `FilterTreeItem` whose `getFocus` captured the `SavedFilter` snapshot at tree-build time ([localstack/viewProvider.ts:199](../../../src/views/localstack/viewProvider.ts)). Editing writes settings and rebuilds the LocalStack tree but never re-runs the Resources producer, and the captured snapshot is stale anyway.
- **#5 Instance views.** Cloud Profiles store views as `SavedFilter`s per profile/region ([settings.ts](../../../src/views/localstack/settings.ts)); the wizard is a 3-step flow ([commands.ts:191](../../../src/views/localstack/commands.ts)). The Instances section only renders `App Inspector` + a static `View: All Resources` ([localstack/viewProvider.ts:141](../../../src/views/localstack/viewProvider.ts)).

## Goals / Non-Goals

**Goals:** fix S3/region-less describe centrally; cap+wrap the details field column; remove multi-select cleanly; make the Resources view track live edits to the active view; add Add/Edit/Remove View to the Instances section with metamodel-intersecting semantics.

**Non-Goals:** reintroducing a reworked multi-select; threading per-resource region through every provider; interactive detail fields; changing the saved-filter settings schema (instance views reuse it).

## Decisions

### Decision: Region fallback in `AWSConfig.getClientConfig` (#1)

When `getClientConfig(profile, region)` receives an empty/undefined region, fall back to `getRegionForProfile(profile)` and then a built-in default (`us-east-1`). One choke point fixes S3 and any other region-less ARN (IAM has the same shape), and listing is unaffected because it always passes the focus region. Alternative — threading the focus region into `setArn`/`describeResource` — was rejected: it ripples through every provider signature and buys little for global services like S3. The describe path will naturally pick up the fallback because the engine builds its client via `getClientConfig`.

### Decision: `table-layout: fixed` for the details table (#2)

Set `table-layout: fixed`, `td.field { width: 33%; white-space: normal; overflow-wrap: break-word; }`, `td.value { width: 67% }`. `table-layout: fixed` is what makes 33% a hard cap (auto layout would let content override it). CSS-only; no change to `tableBody`/`valueCell`.

### Decision: Remove multi-select entirely (#3)

Delete the setting, the two commands, their menus, and the `localstack.multiSelect` context key from `package.json`; collapse `resource-browser.ts` to a single `window.createTreeView("localstack.instances", { canSelectMany: false, ... })` with a fixed selection listener; delete `mergeFocuses` (+ its tests); narrow `computeFocus` to return the single selected selector's focus (still `undefined` when nothing focusable is selected). `computeFocus` keeps its `readonly LocalStackTreeItem[]` parameter (VS Code's selection API hands us an array) but uses only the first focus selector.

### Decision: Live filter resolution + command-driven refresh (#4)

Two parts. (a) `FilterTreeItem` focus producers resolve the filter live: build the focus from `getFilters(profile)`/the instance store looked up by name at selection/refresh time, instead of capturing the `SavedFilter`. (b) The add/edit/remove command handlers refresh the Resources view after mutating settings. This needs the `ResourceViewProvider` (or a `() => void` refresh callback) threaded into `registerLocalStackCommands`, which today receives only the `LocalStackViewProvider`. Because the Resources producer re-runs and reads live settings, refreshing after any view mutation makes the active view reflect edits; a non-active view's producer recomputes to the same focus (no visible change). Removing the active view makes its live lookup yield nothing → the Resources view reverts to its placeholder.

### Decision: Instance views reuse `SavedFilter`, keyed by `localstack`, intersecting the metamodel (#5)

Store instance views under a **dedicated** settings key `localstack.instanceViews`, with no region scope. (Implementation note / deviation: the original plan keyed them in the existing `cloudProfiles.filters` map under a synthetic `localstack` profile, but the bundled `localstack` AWS profile already appears under Cloud Profiles and stores its region views under `getFilters("localstack")` — reusing that key collides, mixing region-scoped cloud views with instance views. A separate key avoids the collision; the `SavedFilter` *type* is still reused, with a placeholder `{ allRegions: true }` scope that instance rendering ignores.) The wizard skips its region-scope step for the instance entry point. The focus for an instance view is computed by **intersecting the live metamodel**: take `computeMetamodelFocus(endpoint)` and keep only the chosen `{ service, resourceType }` pairs. This keeps instance views consistent with the instance's `View: All Resources` (which is the metamodel) and avoids listing types with nothing deployed. Alternative — a wildcard `makeFilterFocus("localstack", …)` reusing the Cloud Profiles path verbatim — was rejected: it would query chosen types even when empty and diverge from the instance's All-Resources behavior. Menus: add `Add View...` on the instance node and `Edit View...`/`Remove View` on instance view rows, gated on the instances-section context values, mirroring the region affordances. **This decision depends on #6:** the intersection is only correct once `computeMetamodelFocus` itself names only present resource types.

### Decision: Metamodel focus names only present resource types (#6)

Today `metamodelToFocus` expands each present service to *all* of the provider's resource types ([metamodelFocus.ts:100-103](../../../src/platforms/aws/models/metamodelFocus.ts)), so empty types render (e.g. all SSM types when only a Parameter exists). The metamodel already carries the granularity: under `service → region`, the keys are the API operations that produced state (e.g. SSM `describeParameters`, S3 `listBuckets`), and their values hold the actual resources. The fix maps each resource type to the metamodel **list operation** that signals its presence, then includes only the types whose operation key appears under that service/region.

- **Operation → type mapping.** Add the list-operation name to each resource-type definition (declarative `defineService` types + every definition, e.g. `parameter → "describeParameters"`). Imperative providers (IAM, CloudFormation, DynamoDB, …) expose the same via a new `ServiceProvider` accessor (e.g. `getResourceTypeMetamodelOps(): Map<resourceType, opName>`), which the declarative engine implements from the annotations and imperative providers implement directly. `computeMetamodelFocus` already builds a per-provider `resourceTypes` map; it gains a parallel per-provider op→type map.
- **Presence test.** Default to **operation-key-present** (the metamodel only records operations that produced state, and the sample confirms only `describeParameters` appears when just a Parameter exists). Keep ARN selectors wildcard so drill-down still lists live — only the *resource-type* axis is narrowed, not the ARN axis. An optional stricter "response non-empty" test is deferred (it needs each op's result-collection key); flagged as an open question to validate against real pods-state behavior.
- **Unmappable operations.** If the metamodel reports an operation a provider can't map (unknown op, or a type with no declared op), fall back to including that service's full type set for safety and log it, so a mapping gap degrades to today's (over-broad) behavior rather than hiding real resources.

Alternative considered — pruning empty type rows at render time by listing every type up front — was rejected: it defeats lazy loading, costs N list calls per service, and conflicts with the "empty resource types still appear" behavior for *explicit* focuses. Using the metamodel's own operation keys needs no extra calls.

## Risks / Trade-offs

- **Wrong default region for a genuinely regional, region-less-ARN resource** → only affects resources whose ARN omits region (S3, IAM — both effectively global); the profile default is a sensible choice and far better than failing.
- **Over-refreshing the Resources view on any view mutation** → cheap (re-lists); acceptable for correctness. Mitigated naturally since non-active views recompute to the same focus.
- **Renaming the active view** → live lookup is by name, so a rename would orphan the active focus; treat as acceptable (Resources reverts to placeholder) or match the renamed view if simple. Captured as a minor edge case.
- **Instance-view metamodel intersection cost** → one metamodel fetch per selection/refresh, same as `View: All Resources` today.
- **Settings continuity** → reusing the filters key under a `localstack` profile means existing Cloud Profiles views are untouched; instance views are additive.

## Migration Plan

1. #1 `getClientConfig` fallback (+ test). 2. #2 details CSS. 3. #3 remove multi-select (package.json + plugin + focus model + tests). 4. #4 live filter resolution + thread Resources refresh into commands. 5. #6 metamodel resource-type accuracy (op→type annotations + provider accessor + `metamodelToFocus`), since #5 builds on it. 6. #5 instance views (settings keying, wizard entry, metamodel-intersect focus, tree rendering, menus). Each step is independently testable; #3–#6 share files so land in that order, with #6 before #5.

Rollback: each fix is self-contained and revertible; removing multi-select is the only user-visible behavior change and is documented in the spec's REMOVED requirement.

## Open Questions

- On renaming the active view, prefer "revert to placeholder" (simplest) or follow the rename? Default: revert.
- Built-in fallback region `us-east-1` — acceptable, or read from an env/SDK default chain? Default: `us-east-1` after the profile default.
- #6 presence test: is operation-key-present sufficient, or does LocalStack pods-state ever record an operation with an empty result (requiring a "response non-empty" check)? Verify against real pods-state; default to key-present until shown otherwise.
- #6 op→type cardinality: are there resource types listed via multiple operations, or operations that map to multiple types? The sample is 1:1; confirm across definitions and decide whether the annotation should be a list of ops.
