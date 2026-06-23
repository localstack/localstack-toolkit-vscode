## Why

Five independent issues degrade the resource browser and LocalStack view: S3 (and other region-less) resources can't be inspected, long detail labels crowd out their values, the half-working multi-select adds complexity without payoff, edits to a saved view don't reach the open Resources view, and the LocalStack Instances section lacks the saved-view affordances that Cloud Profiles already has. These are bundled into one change because #3/#4/#5 touch the same files (the LocalStack view, focus model, and command/menu wiring).

## What Changes

- **Fix S3 "Region is missing" (#1):** S3 bucket ARNs are region-less (`arn:aws:s3:::name`), so `describeResource` builds an SDK client with an empty region. `AWSConfig.getClientConfig` SHALL fall back to the profile's default region (then `us-east-1`) when no region is given, fixing S3 and any other region-less ARN centrally. Listing is unaffected (it always passes the focus region).
- **Cap the Resource Details first column (#2):** the details webview's field column SHALL be capped at 33% of the width and word-wrap, instead of `white-space: nowrap` forcing long labels to consume the row. CSS-only.
- **Remove the multi-select concept (#3):** delete the `localstack.focus.multiSelect` setting, the enable/disable commands, their menus, and the `localstack.multiSelect` context key; collapse the tree-view re-registration to a single `canSelectMany: false` registration; remove `mergeFocuses` and simplify `computeFocus` to a single selection. **BREAKING (user-facing):** the multi-select toggle is gone; views are selected one at a time.
- **Refresh the Resources view when an active view is edited (#4):** saved-view focus selectors SHALL resolve their definition live (by profile + name) rather than from a snapshot captured at tree-build time, and the add/edit/remove view commands SHALL refresh the Resources view. Deleting the active view clears the Resources view to its placeholder; renaming keeps it active.
- **Add views to the LocalStack Instances section (#5):** the Instances section SHALL support Add/Edit/Remove View matching Cloud Profiles, reusing the saved-filter store keyed by a synthetic `localstack` profile and dropping the region-scope step. A filtered instance view SHALL intersect the live metamodel (start from the deployed resources, keep only the chosen service/resource-type pairs), staying consistent with the instance's `View: All Resources`.
- **Make the metamodel focus resource-type-accurate (#6):** the `View: All Resources` selector currently expands every present service to *all* its registered resource types, so empty types (e.g. all SSM types when only an SSM Parameter exists) render. The metamodel already carries resource-type granularity (its per-service API-operation keys, e.g. `describeParameters`), which is discarded. `computeMetamodelFocus` SHALL include only the resource types whose metamodel operation is present, by mapping each resource type to its list operation. This is foundational to #5, whose metamodel intersection inherits this accuracy.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `resource-browser`: the **Resource Details view** requirement gains the column-width/word-wrap rule and the region-fallback behavior for region-less ARNs; the **Resources view** reflects edits to the active saved view without reselection.
- `localstack-explorer-view`: **Single- and multi-select behavior** becomes single-select only (multi-select removed); the **LocalStack Instances section** gains saved views; **Add new view** / **Edit and remove filters** extend to the Instances section and refresh the Resources view on change.
- `localstack-metamodel`: **Live resource listing under the metamodel focus** changes so the focus names only the resource types actually present in the metamodel (per its API-operation keys), rather than leaving every resource-type selector as a wildcard.

## Impact

- **Code:** `src/platforms/aws/models/awsConfig.ts` (region fallback); `src/views/resource-details/viewProvider.ts` (CSS); `src/plugins/resource-browser.ts` (drop multi-select wiring, thread Resources refresh into commands); `src/models/focus.ts` (remove `mergeFocuses`); `src/views/localstack/{viewProvider,commands,treeItems,settings}.ts` (single-select `computeFocus`, live filter resolution, instance views); `src/views/resources/viewProvider.ts` (refresh hook); `src/platforms/aws/models/metamodelFocus.ts` (resource-type-accurate focus); `src/platforms/aws/services/serviceProvider.ts` + declarative engine/`defineService` types + every service definition (expose each resource type's metamodel list-operation, and a `ServiceProvider` op→type accessor for imperative providers); `package.json` (remove multi-select setting/commands/menus/context; add instance-section view menus).
- **Tests:** remove `mergeFocuses` tests; add tests for the region fallback, single-select `computeFocus`, live filter resolution, and instance-view focus intersection.
- **Settings migration:** `localstack.focus.multiSelect` is removed; any stored value is ignored (no data loss, behavior reverts to single-select).
- **No new dependencies.**
