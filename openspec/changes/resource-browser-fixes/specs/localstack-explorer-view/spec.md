## MODIFIED Requirements

### Requirement: LocalStack Instances section

Under **LocalStack Instances**, the system SHALL show an instance node labeled `AWS (<Status>): <host:port>`, where the endpoint is derived from the endpoint the Toolkit is configured to use (the `localstack` profile's `endpoint_url` in `~/.aws/config`) rather than a hardcoded value, and `<Status>` is the live emulator status with its first letter capitalized (e.g. `Running`, `Stopped`). The status SHALL be presented on the same line as the endpoint, NOT as a separate `Status` child node. The instance node SHALL show child nodes only when the emulator is running: an `App Inspector` node that opens the App Inspector when clicked, a `View: All Resources` focus selector, and one `View: <name>` focus selector per user-defined view saved for the instance. When the emulator is not running, the instance node SHALL have no children and SHALL render as a non-expandable line (no twistie).

The instance node SHALL offer an `Add View...` action (matching the Cloud Profiles region affordance); each instance `View: <name>` row SHALL offer `Edit View...` / `Remove View` actions. Instance views SHALL be persisted in the same saved-filter store as Cloud Profiles views, keyed by the synthetic `localstack` profile, and SHALL NOT carry a region scope (the region-scope step is omitted for instance views). Selecting an instance view SHALL produce a focus that **intersects the live metamodel**: starting from the resources actually deployed in the running instance (the same source as `View: All Resources`) and keeping only the chosen service/resource-type pairs, so an instance view never lists a type with nothing deployed.

#### Scenario: Stopped instance shows the status line and no children

- **WHEN** the emulator is stopped and the endpoint is `localhost:4566`
- **THEN** the instance node is labeled `AWS (Stopped): localhost:4566`, with no separate `Status` child node, no `App Inspector`/`View: All Resources` children, and no expand twistie

#### Scenario: Running instance exposes app inspector and a focus selector

- **WHEN** the emulator is running and the LocalStack Instances section is expanded
- **THEN** the instance node shows an `App Inspector` child and a `View: All Resources` focus selector child (and no standalone `Status` child)

#### Scenario: Children appear and disappear with live status

- **WHEN** the emulator transitions from stopped to running (or vice versa)
- **THEN** the instance node gains (or loses) its `App Inspector` and `View: All Resources` children without a manual refresh

#### Scenario: Instance label reflects the configured endpoint

- **WHEN** the `localstack` profile's `endpoint_url` is `http://127.0.0.1:4566` (e.g. DNS rebind protection is active)
- **THEN** the instance node's `host:port` is `127.0.0.1:4566`, matching the endpoint the SDK and metamodel calls use, not a hardcoded `localhost.localstack.cloud:4566`

#### Scenario: Status reflects the running emulator

- **WHEN** the emulator status changes (e.g. stopped → running)
- **THEN** the instance node's label updates to the new capitalized status (e.g. `AWS (Running): …`) without requiring a manual refresh, and the `App Inspector` node's description updates accordingly (see App Inspector scenarios)

#### Scenario: Status detects containers started under alternate names

- **WHEN** the emulator container is started by the `lstk` CLI under the name `localstack-aws` (rather than `localstack-main`)
- **THEN** the status reflects `Running` once the emulator is healthy, because the status tracker watches all known emulator container names — `localstack-main` and `localstack-aws` — for both the initial `docker inspect`/`ps` check and the live `docker events` stream

#### Scenario: Adding a view to the instance

- **WHEN** the emulator is running and the user invokes `Add View...` on the instance node, names the view, and selects one or more service/resource-type pairs
- **THEN** a `View: <name>` focus selector appears under the instance node and is saved for the instance (no region-scope step is shown)

#### Scenario: An instance view shows only deployed resources of the chosen types

- **WHEN** the user selects an instance view whose chosen pairs include a resource type with nothing deployed in the running instance
- **THEN** the Resources view shows only the deployed resources among the chosen pairs, consistent with `View: All Resources`, and does not list the empty type

### Requirement: Add new view

The system SHALL let the user define a named filter via the `Add View...` action — invoked from a region row's inline plus icon (also in the right-click context menu) and from the LocalStack Instance node — by selecting a set of **service / resource-type pairs** (e.g. `SQS — Queues`, `Lambda — Functions`), not whole services. This lets a view include some resource types of a service while excluding others. In the UX a saved filter is labeled a "view" (the actions are `Add View...`, `Edit View...`, `Remove View`); the underlying concept and the `localstack.cloudProfiles.filters` settings key are unchanged (the per-filter value now stores a list of `{ service, resourceType }` pairs), and the remainder of this spec refers to the concept as a "filter" for continuity with the persisted model. For a **Cloud Profiles** region, a filter is by default scoped to the single region it was created under; the dialog SHALL offer an "apply to all regions" option that instead makes the filter available under every region of that profile. For a **LocalStack Instance** view, the region-scope step SHALL be omitted (instance views always apply to the running instance) and the view is stored under the synthetic `localstack` profile. The filter SHALL appear as a focus selector labeled `View: <name>`, scoped to the chosen pairs, and SHALL be persisted with its scope. The name SHALL be unique within the profile (or instance) and SHALL NOT be `All Resources` (case-insensitive), which is reserved for the built-in all-resources selector; the dialog SHALL reject a reserved or duplicate name.

#### Scenario: Creating a region-scoped filter

- **WHEN** the user invokes `Add View...` from a region, names it, selects one or more service/resource-type pairs, and leaves "apply to all regions" off
- **THEN** a new focus selector labeled `View: <name>` appears under that region only and is saved with a single-region scope

#### Scenario: The reserved name is rejected

- **WHEN** the user enters `All Resources` (in any letter case) as the view name
- **THEN** the dialog rejects it as a reserved view name and does not save a filter

#### Scenario: Creating a filter applied to all regions

- **WHEN** the user invokes `Add View...`, selects pairs, and enables "apply to all regions"
- **THEN** the filter appears under every region of that profile and is saved with an all-regions scope

#### Scenario: Creating an instance view omits the region-scope step

- **WHEN** the user invokes `Add View...` on the LocalStack Instance node and selects pairs
- **THEN** no region-scope choice is presented and the view is saved for the instance under the synthetic `localstack` profile

#### Scenario: Selecting a filter scopes the Resources view to its resource types

- **WHEN** the user selects a saved filter focus selector
- **THEN** the Resources view shows only the service/resource-type pairs chosen for that filter

### Requirement: Edit and remove filters

The system SHALL let the user edit or remove a saved filter via `Edit View...` / `Remove View` actions on the filter row (an inline gear icon for `Edit View...` and a trash icon for `Remove View`, also in the right-click context menu), for both Cloud Profiles region views and LocalStack Instance views. The `Edit View...` icon SHALL be the same gear (settings) icon used by `Select Profiles...` / `Select Regions...`. Editing SHALL reopen the filter wizard pre-populated with the filter's current name, services, and scope, and overwrite the saved filter with the new values. Removing SHALL first present a modal confirmation dialog and SHALL delete the filter from the workspace settings only when the user confirms. After a successful add, edit, or remove, the system SHALL refresh the Resources view so that, when the affected view is the active focus, the Resources view reflects the change (or reverts to its placeholder if the active view was removed) without the user reselecting it.

#### Scenario: Editing a filter updates it

- **WHEN** the user invokes Edit on a filter, changes its services, and confirms
- **THEN** the filter's saved services are updated and the focus selector reflects the new scope

#### Scenario: Editing the active filter refreshes the Resources view

- **WHEN** the user edits the filter that is currently the active focus
- **THEN** the Resources view refreshes to reflect the new definition without the user reselecting the view

#### Scenario: Removing a filter deletes it

- **WHEN** the user invokes Remove on a filter and confirms the dialog
- **THEN** the filter no longer appears under any region (or under the instance) and is deleted from workspace settings

#### Scenario: Cancelling the confirmation keeps the filter

- **WHEN** the user invokes Remove on a filter and cancels the dialog
- **THEN** the filter is left unchanged

## REMOVED Requirements

### Requirement: Single- and multi-select behavior

**Reason**: Multi-select (selecting several focus selectors and merging their focuses) did not work reliably and needs to be rethought before being reintroduced. The view reverts to single-select only.

**Migration**: The `localstack.focus.multiSelect` setting, its enable/disable title-menu actions, and the `localstack.multiSelect` context key are removed. Any persisted setting value is ignored; the view always behaves as single-select. Replaced by the "Single-select behavior" requirement below.

## ADDED Requirements

### Requirement: Single-select behavior

The system SHALL use single-select for focus selectors: activating one focus selector SHALL deactivate any other, and the Resources view SHALL reflect exactly the most recently selected focus. The system SHALL NOT provide a multi-select mode or a toggle for one.

#### Scenario: Selecting a focus selector replaces the active focus

- **WHEN** the user selects a focus selector and then selects a different one
- **THEN** only the most recently selected focus is active and the Resources view reflects it alone

#### Scenario: No multi-select toggle is present

- **WHEN** the user opens the LocalStack view's `...` title menu
- **THEN** no enable/disable multi-select action is shown
