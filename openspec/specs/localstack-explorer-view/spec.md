# localstack-explorer-view Specification

## Purpose
The combined **Explore** tree view in the LocalStack activity-bar container: its LocalStack Instances / Cloud Profiles / Workspace IaC sections, the focus selectors that drive the Resources view, single-select behavior, and the user-added regions, saved views, instance views, and shown profiles persisted to settings.

## Requirements
### Requirement: Combined Explore tree view

The system SHALL provide a single tree view named "Explore" in the LocalStack activity-bar container with three top-level sections in this order: **LocalStack Instances**, **Cloud Profiles**, and **Workspace IaC**. The view name SHALL be "Explore" (not "LocalStack") to avoid visual duplication with the "LocalStack" activity-bar container title. No separator nodes SHALL be rendered between the sections.

#### Scenario: Three sections are shown at the root

- **WHEN** the Explore view is rendered
- **THEN** the three top-level section nodes appear in order — "LocalStack Instances", "Cloud Profiles", and "Workspace IaC" — with no separator node between them

#### Scenario: View name avoids container duplication

- **WHEN** the Explore view is rendered inside the "LocalStack" activity-bar container
- **THEN** the view's name reads "Explore", not "LocalStack"

### Requirement: Initial view sizing

When the LocalStack activity-bar container is first opened, the system SHALL allocate approximately 50% of the available vertical space to the **Resources** view and approximately 25% each to the **Explore** and **Resource Details** views, via relative `size` weights on the view contributions (Resources `2`, the other two `1`). This applies to first layout; the user's subsequent manual resizing persists and overrides these defaults.

#### Scenario: Resources view gets half the height on first open

- **WHEN** the LocalStack activity-bar container is opened for the first time
- **THEN** the Resources view occupies roughly half the vertical space and the Explore and Resource Details views occupy roughly a quarter each

### Requirement: LocalStack Instances section

Under **LocalStack Instances**, the system SHALL show an instance node labeled `AWS (<Status>): <host:port>`, where the endpoint is derived from the endpoint the Toolkit is configured to use (the `localstack` profile's `endpoint_url` in `~/.aws/config`) rather than a hardcoded value, and `<Status>` is the live emulator status with its first letter capitalized (e.g. `Running`, `Stopped`). The status SHALL be presented on the same line as the endpoint, NOT as a separate `Status` child node. The instance node SHALL show child nodes only when the emulator is running: an `App Inspector` node that opens the App Inspector when clicked, a `View: All Resources` focus selector, and one `View: <name>` focus selector per user-defined view saved for the instance. When the emulator is not running, the instance node SHALL have no children and SHALL render as a non-expandable line (no twistie).

The instance node SHALL offer an `Add View...` action (matching the Cloud Profiles region affordance); each instance `View: <name>` row SHALL offer `Edit View...` / `Remove View` actions. Instance views SHALL be persisted in a dedicated saved-view store (separate from the Cloud Profiles per-region views, to avoid colliding with the bundled `localstack` cloud profile) and SHALL NOT carry a region scope (the region-scope step is omitted for instance views). Selecting an instance view SHALL produce a focus that **intersects the live metamodel**: starting from the resources actually deployed in the running instance (the same source as `View: All Resources`) and keeping only the chosen service/resource-type pairs, so an instance view never lists a type with nothing deployed.

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

### Requirement: App Inspector node

The `App Inspector` node under an instance SHALL display a magnifying-glass icon (the `search` theme icon) and SHALL open the existing App Inspector webview when clicked. Because the node is only shown when the emulator is running, its description SHALL read `Click to open`.

#### Scenario: App Inspector shows a magnifying-glass icon

- **WHEN** the running instance node is expanded
- **THEN** the `App Inspector` node displays the `search` (magnifying glass) theme icon and a `Click to open` description

#### Scenario: App Inspector opens the existing webview

- **WHEN** the user clicks the `App Inspector` node
- **THEN** the existing App Inspector webview panel opens (behavior unchanged from before this change)

### Requirement: Cloud Profiles section

Under **Cloud Profiles**, the system SHALL show one node per AWS profile discovered in `~/.aws/config` (including `default` and the bundled `localstack` profile), labeled `AWS: <profile>`. Each profile SHALL show its configured default region plus any user-added regions; each region SHALL contain a `View All Resources` focus selector, the filters applicable to that region, and one `Stack: <stack>` focus selector per active CloudFormation stack in that region. Region-level actions (`Add View...`, and `Remove Region` for user-added regions) are available on the region row as inline icons and in the right-click context menu, not as child action nodes. The profile's region set is managed from the profile row's `Select Regions...` action (an inline filter icon, also in the context menu), also not via a child action node.

#### Scenario: Profiles are listed from AWS config

- **WHEN** the Cloud Profiles section is expanded and `~/.aws/config` defines profiles `default` and `staging`
- **THEN** nodes `AWS: default` and `AWS: staging` appear

#### Scenario: A region lists its focus selectors

- **WHEN** a profile's region is expanded
- **THEN** it shows `View: All Resources`, the filters applicable to that region (each labeled `View: <name>`), and one `Stack: <stack>` selector per active CloudFormation stack (the `Add View...` action is on the region row, not a child node)

#### Scenario: The bundled localstack profile is shown

- **WHEN** `~/.aws/config` includes the bundled `localstack` profile
- **THEN** an `AWS: localstack` node appears under Cloud Profiles, in addition to the LocalStack Instances section

#### Scenario: Invalid credentials surface an error node

- **WHEN** a profile cannot be queried (e.g. invalid credentials)
- **THEN** an error node is shown for that profile rather than failing the whole view

### Requirement: Select which Cloud Profiles are shown

By default, only the profile named `default` SHALL be shown under Cloud Profiles; when no profile named `default` exists, the first discovered profile SHALL be shown instead. The set of shown profiles SHALL be persisted in `localstack.cloudProfiles.shown` (a list of profile names) and SHALL NOT modify `~/.aws/config`. When the setting is **unset**, the system SHALL apply the default-only behavior above; when it is set (including the empty list), the system SHALL honor it exactly. The Cloud Profiles section row SHALL offer a `Select Profiles...` action (an inline gear icon, also in the right-click context menu) that opens a multi-select picker of all discovered profiles, pre-checked with the currently shown set; confirming SHALL persist the checked names as the shown set. When the shown set is empty, the section SHALL render a single non-interactive `No profiles selected` placeholder.

#### Scenario: Only the default profile is shown initially

- **WHEN** the Cloud Profiles section is first rendered, `localstack.cloudProfiles.shown` is unset, and `~/.aws/config` defines `default` and `staging`
- **THEN** only `AWS: default` appears, and `AWS: staging` is hidden until explicitly enabled

#### Scenario: First profile shown when none is named default

- **WHEN** `localstack.cloudProfiles.shown` is unset and no profile is named `default`
- **THEN** the first discovered profile is shown

#### Scenario: Enabling additional profiles

- **WHEN** the user opens `Select Profiles...` and checks `staging`
- **THEN** `AWS: staging` appears under Cloud Profiles and the choice is saved to `localstack.cloudProfiles.shown` without changing `~/.aws/config`

#### Scenario: Deselecting every profile shows a placeholder

- **WHEN** the user opens `Select Profiles...` and unchecks every profile
- **THEN** the Cloud Profiles section shows a single `No profiles selected` placeholder, and the empty selection is honored (not reset to the default)

#### Scenario: Shown profiles persist across reloads

- **WHEN** the workspace is reloaded after changing which profiles are shown
- **THEN** the same set of profiles is shown

### Requirement: Settings persistence target

All view-state writes (added regions, saved filters/views, instance views, and shown profiles) SHALL persist to Workspace settings when a workspace folder is open, and SHALL fall back to Global (User) settings when no workspace folder is open. Writing SHALL NOT fail when no folder is open.

#### Scenario: Persists per-workspace when a folder is open

- **WHEN** a workspace folder is open and the user changes a view-state setting (e.g. hides a profile)
- **THEN** the change is written to Workspace settings and applies to that workspace

#### Scenario: Falls back to global with no folder open

- **WHEN** no workspace folder is open and the user changes a view-state setting
- **THEN** the change is written to Global (User) settings without error, rather than failing with "Unable to write to Workspace Settings"

### Requirement: Workspace IaC placeholder

Under **Workspace IaC**, the system SHALL show a single placeholder child with the literal text `Coming soon`.

#### Scenario: Placeholder is shown

- **WHEN** the Workspace IaC section is expanded
- **THEN** a single non-interactive `Coming soon` node is shown

### Requirement: Row actions are shown as inline icons and in the context menu

The per-row actions in the Explore view SHALL be shown as inline action icons on the row (a hover toolbar) AND remain available in the row's right-click context menu. (VS Code only renders a tree row's `...` overflow alongside an inline action, so a row with no inline action has no `...` button at all; the actions are therefore contributed inline so they are always visible.) The inline icons SHALL be: an edit (pencil) icon for `Select Profiles...` (Cloud Profiles section row) and `Select Regions...` (profile row), a plus icon for `Add View...` (region rows and the instance node), a trash icon for `Remove Region` (user-added region rows), and a pencil icon for `Edit View...` plus a trash icon for `Remove View` (saved-view rows). Each of these SHALL also be contributed as a non-inline `view/item/context` item so it appears in the right-click menu.

#### Scenario: Row actions show an inline icon

- **WHEN** the user hovers the Cloud Profiles section row, a profile row, a region row, a user-added region row, or a saved-view row
- **THEN** the corresponding inline icon(s) are shown (pencil; pencil; plus; trash; pencil and trash respectively) and clicking one invokes the action

#### Scenario: Inline actions are also in the context menu

- **WHEN** the user right-clicks a row that has an inline action
- **THEN** the same action(s) are also listed in the context menu

### Requirement: Select Regions

The system SHALL let the user choose which regions are shown under a Cloud Profile via a `Select Regions...` action on the profile row (an inline filter icon, also in the right-click context menu) — not via a separate child node. The action opens a multi-select picker of all known regions (excluding the profile's configured default region, which is always shown). The picker SHALL be pre-checked with the regions currently shown for that profile; confirming SHALL replace the set of user-added regions (adding newly-checked and removing unchecked ones in a single action). The chosen regions SHALL be persisted per profile so they reappear on reload.

#### Scenario: Select Regions lives on the profile row

- **WHEN** the user views a profile row (e.g. `AWS: default`)
- **THEN** a `Select Regions...` action is available as an inline filter icon and in the right-click context menu, and there is no separate `Show more regions` child node under the profile

#### Scenario: Selecting multiple regions persists them

- **WHEN** the user invokes `Select Regions...` for a profile and checks several regions
- **THEN** all checked regions appear under that profile and are saved to settings

#### Scenario: Deselecting removes a region

- **WHEN** the user invokes `Select Regions...` and unchecks a currently-shown region
- **THEN** that region is removed from the profile (the configured default region is never offered for deselection)

#### Scenario: Added regions survive reload

- **WHEN** the workspace is reloaded after regions were added
- **THEN** the previously added regions are still shown under that profile

### Requirement: Remove a region

The system SHALL let the user remove a user-added region via a `Remove Region` action on that region row (an inline trash icon, also in the right-click context menu), removing only that one region from the workspace settings. Invoking the action SHALL first present a modal confirmation dialog; the region SHALL be removed only when the user confirms. The profile's configured default region SHALL always be shown and SHALL NOT offer a remove action.

#### Scenario: Removing a user-added region

- **WHEN** the user invokes Remove on a user-added region node and confirms the dialog
- **THEN** that single region is removed from the profile and from workspace settings, and other regions remain

#### Scenario: Cancelling the confirmation keeps the region

- **WHEN** the user invokes Remove on a user-added region node and cancels the dialog
- **THEN** the region is not removed and settings are unchanged

#### Scenario: Default region cannot be removed

- **WHEN** the user views the profile's configured default region node
- **THEN** no remove action is offered for it

### Requirement: Add new view

The system SHALL let the user define a named filter via the `Add View...` action — invoked from a region row's inline plus icon (also in the right-click context menu) and from the LocalStack Instance node — by selecting a set of **service / resource-type pairs** (e.g. `SQS — Queues`, `Lambda — Functions`), not whole services. This lets a view include some resource types of a service while excluding others. In the UX a saved filter is labeled a "view" (the actions are `Add View...`, `Edit View...`, `Remove View`); the underlying concept and the `localstack.cloudProfiles.filters` settings key are unchanged (the per-filter value stores a list of `{ service, resourceType }` pairs), and the remainder of this spec refers to the concept as a "filter" for continuity with the persisted model. For a **Cloud Profiles** region, a filter is by default scoped to the single region it was created under; the dialog SHALL offer an "apply to all regions" option that instead makes the filter available under every region of that profile. For a **LocalStack Instance** view, the region-scope step SHALL be omitted (instance views always apply to the running instance) and the view is stored in the dedicated instance-view store. The filter SHALL appear as a focus selector labeled `View: <name>`, scoped to the chosen pairs, and SHALL be persisted with its scope. The name SHALL be unique within the profile (or instance) and SHALL NOT be `All Resources` (case-insensitive), which is reserved for the built-in all-resources selector; the dialog SHALL reject a reserved or duplicate name.

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
- **THEN** no region-scope choice is presented and the view is saved for the instance

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

### Requirement: Focus selectors drive the active focus

The system SHALL treat `View: All Resources`, saved filters (`View: <name>`), and `Stack: <stack>` nodes as focus selectors. Selecting a focus selector SHALL compute its focus and set it as the active focus for the Resources view. Focus selectors SHALL carry a transparent (`blank`) icon so their labels align with icon-bearing sibling rows — specifically so the instance's `View: All Resources` selector lines up with the `App Inspector` node. This is the only place a `blank` icon is used; other iconless rows render without one.

#### Scenario: Selecting a focus selector updates the Resources view

- **WHEN** the user clicks a focus selector
- **THEN** the Resources view re-renders to show the resources described by that selector's focus

### Requirement: Single-select behavior

The system SHALL use single-select for focus selectors: activating one focus selector SHALL deactivate any other, and the Resources view SHALL reflect exactly the most recently selected focus. The system SHALL NOT provide a multi-select mode or a toggle for one.

#### Scenario: Selecting a focus selector replaces the active focus

- **WHEN** the user selects a focus selector and then selects a different one
- **THEN** only the most recently selected focus is active and the Resources view reflects it alone

#### Scenario: No multi-select toggle is present

- **WHEN** the user opens the LocalStack view's `...` title menu
- **THEN** no enable/disable multi-select action is shown

### Requirement: Resource-browser opt-in gating

The Explore tree SHALL operate in one of two modes determined by the persisted flag `localstack.resourceBrowserEnabled` (stored in the extension's `globalState`, default disabled). The mode SHALL be read live on each render so a toggle takes effect on the next refresh without a window reload.

When **disabled** (the default), the Explore tree SHALL render only the **LocalStack Instances** section at its root, followed by a single opt-in affordance node. The **Cloud Profiles** and **Workspace IaC** sections SHALL NOT be rendered. The instance node, when running, SHALL show only the `App Inspector` child — the `View: All Resources` selector and any saved instance views SHALL NOT be rendered, because they drive the gated-off Resources view.

When **enabled**, the Explore tree SHALL render the three sections (LocalStack Instances, Cloud Profiles, Workspace IaC) exactly as specified by the "Combined Explore tree view" and "LocalStack Instances section" requirements, followed by a single opt-out affordance node.

#### Scenario: Default mode shows only the instances section and an opt-in node

- **WHEN** the flag is disabled and the Explore view is rendered
- **THEN** the root shows the "LocalStack Instances" section and an opt-in node labeled to enable the resource browser, and shows neither the "Cloud Profiles" nor the "Workspace IaC" section

#### Scenario: Default-mode running instance shows only App Inspector

- **WHEN** the flag is disabled, the emulator is running, and the LocalStack Instances section is expanded
- **THEN** the instance node shows the `App Inspector` child and does NOT show a `View: All Resources` selector or any saved instance views

#### Scenario: Enabled mode shows all three sections and an opt-out node

- **WHEN** the flag is enabled and the Explore view is rendered
- **THEN** the root shows the "LocalStack Instances", "Cloud Profiles", and "Workspace IaC" sections in order, followed by an opt-out node labeled to disable the resource browser

### Requirement: Opt-in and opt-out affordances

The Explore tree SHALL render a clickable affordance node at the end of its root. When the resource browser is disabled the node SHALL invoke a command that enables it; when enabled the node SHALL invoke a command that disables it. Enabling SHALL persist `true` and disabling SHALL persist `false` to the `localstack.resourceBrowserEnabled` flag in `globalState`, update the matching VS Code context key, and refresh the Explore tree. The affordance node SHALL NOT act as a focus selector and SHALL NOT drive the Resources view.

#### Scenario: Clicking the opt-in node reveals the full experience

- **WHEN** the resource browser is disabled and the user clicks the opt-in node
- **THEN** the flag is persisted as enabled, the Resources and Resource Details views become visible, and the Explore tree re-renders with all three sections and an opt-out node — without a window reload

#### Scenario: Clicking the opt-out node restores the minimal experience

- **WHEN** the resource browser is enabled and the user clicks the opt-out node
- **THEN** the flag is persisted as disabled, the Resources and Resource Details views become hidden, and the Explore tree re-renders with only the LocalStack Instances section and an opt-in node
