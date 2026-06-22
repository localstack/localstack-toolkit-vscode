## ADDED Requirements

### Requirement: Combined Explore tree view

The system SHALL provide a single tree view named "Explore" in the LocalStack activity-bar container with three top-level sections in this order: **LocalStack Instances**, **Cloud Profiles**, and **Workspace IaC**. The view name SHALL be "Explore" (not "LocalStack") to avoid visual duplication with the "LocalStack" activity-bar container title.

A visual separator (a non-interactive node whose label is a short fixed run of dashes) SHALL be rendered *between* adjacent sections — i.e. between **LocalStack Instances** and **Cloud Profiles**, and between **Cloud Profiles** and **Workspace IaC** — but not before the first section or after the last. The dash run is intentionally short (not full-width): VS Code provides no panel width to the tree provider and always appends an ellipsis to overflowing labels, so a short run avoids a trailing `…` at typical panel widths.

#### Scenario: Three sections are shown at the root

- **WHEN** the Explore view is rendered
- **THEN** the three top-level section nodes appear in order — "LocalStack Instances", "Cloud Profiles", and "Workspace IaC" — separated by a dash-run separator node between each adjacent pair

#### Scenario: View name avoids container duplication

- **WHEN** the Explore view is rendered inside the "LocalStack" activity-bar container
- **THEN** the view's name reads "Explore", not "LocalStack"

### Requirement: Initial view sizing

When the LocalStack activity-bar container is first opened, the system SHALL allocate approximately 50% of the available vertical space to the **Resources** view and approximately 25% each to the **Explore** and **Resource Details** views, via relative `size` weights on the view contributions (Resources `2`, the other two `1`). This applies to first layout; the user's subsequent manual resizing persists and overrides these defaults.

#### Scenario: Resources view gets half the height on first open

- **WHEN** the LocalStack activity-bar container is opened for the first time
- **THEN** the Resources view occupies roughly half the vertical space and the Explore and Resource Details views occupy roughly a quarter each

### Requirement: LocalStack Instances section

Under **LocalStack Instances**, the system SHALL show an instance node labeled `AWS (<Status>): <host:port>`, where the endpoint is derived from the endpoint the Toolkit is configured to use (the `localstack` profile's `endpoint_url` in `~/.aws/config`) rather than a hardcoded value, and `<Status>` is the live emulator status with its first letter capitalized (e.g. `Running`, `Stopped`). The status SHALL be presented on the same line as the endpoint, NOT as a separate `Status` child node. The instance node's children are: an `App Inspector` node that opens the App Inspector when clicked, and a `View All Resources` focus selector.

#### Scenario: Status is shown on the endpoint line, capitalized

- **WHEN** the emulator is stopped and the endpoint is `localhost:4566`
- **THEN** the instance node is labeled `AWS (Stopped): localhost:4566`, with no separate `Status` child node

#### Scenario: Instance node exposes app inspector and a focus selector

- **WHEN** the LocalStack Instances section is expanded
- **THEN** the instance node shows an `App Inspector` child and a `View All Resources` focus selector child (and no standalone `Status` child)

#### Scenario: Instance label reflects the configured endpoint

- **WHEN** the `localstack` profile's `endpoint_url` is `http://127.0.0.1:4566` (e.g. DNS rebind protection is active)
- **THEN** the instance node's `host:port` is `127.0.0.1:4566`, matching the endpoint the SDK and metamodel calls use, not a hardcoded `localhost.localstack.cloud:4566`

#### Scenario: Status reflects the running emulator

- **WHEN** the emulator status changes (e.g. stopped → running)
- **THEN** the instance node's label updates to the new capitalized status (e.g. `AWS (Running): …`) without requiring a manual refresh, and the `App Inspector` node's description updates accordingly (see App Inspector scenarios)

#### Scenario: Status detects containers started under alternate names

- **WHEN** the emulator container is started by the `lstk` CLI under the name `localstack-aws` (rather than `localstack-main`)
- **THEN** the status reflects `Running` once the emulator is healthy, because the status tracker watches all known emulator container names — `localstack-main` and `localstack-aws` — for both the initial `docker inspect`/`ps` check and the live `docker events` stream

### Requirement: App Inspector node

The `App Inspector` node under an instance SHALL display a magnifying-glass icon (the `search` theme icon) and SHALL open the existing App Inspector webview when clicked. Its description SHALL reflect the emulator's running state: `Click to open` only when the emulator is running, and `Not running` otherwise.

#### Scenario: App Inspector shows a magnifying-glass icon

- **WHEN** the LocalStack Instances section is expanded
- **THEN** the `App Inspector` node displays the `search` (magnifying glass) theme icon

#### Scenario: App Inspector description tracks running state

- **WHEN** the emulator is not running
- **THEN** the `App Inspector` node's description reads `Not running`
- **WHEN** the emulator is running
- **THEN** the `App Inspector` node's description reads `Click to open`

#### Scenario: App Inspector opens the existing webview

- **WHEN** the user clicks the `App Inspector` node while the emulator is running
- **THEN** the existing App Inspector webview panel opens (behavior unchanged from before this change)

### Requirement: Cloud Profiles section

Under **Cloud Profiles**, the system SHALL show one node per AWS profile discovered in `~/.aws/config` (including `default` and the bundled `localstack` profile), labeled `AWS: <profile>`. Each profile SHALL show its configured default region plus any user-added regions; each region SHALL contain a `View All Resources` focus selector, the filters applicable to that region, and one `CFN: <stack>` focus selector per active CloudFormation stack in that region. Region-level actions (`Add View...`, and `Remove Region` for user-added regions) are available on the region row as inline icons and in the right-click context menu, not as child action nodes. The profile's region set is managed from the profile row's `Select Regions...` action (an inline filter icon, also in the context menu), also not via a child action node.

#### Scenario: Profiles are listed from AWS config

- **WHEN** the Cloud Profiles section is expanded and `~/.aws/config` defines profiles `default` and `staging`
- **THEN** nodes `AWS: default` and `AWS: staging` appear

#### Scenario: A region lists its focus selectors

- **WHEN** a profile's region is expanded
- **THEN** it shows `View All Resources`, the filters applicable to that region, and one `CFN: <stack>` selector per active CloudFormation stack (the `Add View...` action lives in the region row's `...` menu, not as a child node)

#### Scenario: The bundled localstack profile is shown

- **WHEN** `~/.aws/config` includes the bundled `localstack` profile
- **THEN** an `AWS: localstack` node appears under Cloud Profiles, in addition to the LocalStack Instances section

#### Scenario: Invalid credentials surface an error node

- **WHEN** a profile cannot be queried (e.g. invalid credentials)
- **THEN** an error node is shown for that profile rather than failing the whole view

### Requirement: Hide and reveal Cloud Profiles

All discovered profiles SHALL be shown initially. The Cloud Profiles section row SHALL offer a `Select Profiles...` action (an inline filter icon, also in the right-click context menu) that opens a multi-select picker of all profiles, where checked profiles are shown and unchecked profiles are hidden. The set of hidden profiles SHALL be persisted in `localstack.cloudProfiles.hidden` and SHALL NOT modify `~/.aws/config`. Hidden profiles SHALL be omitted from the section until revealed again.

#### Scenario: Hiding a profile removes it from the section

- **WHEN** the user opens `Select Profiles...` from the Cloud Profiles row and unchecks a profile
- **THEN** that profile no longer appears under Cloud Profiles, and the choice is saved to `localstack.cloudProfiles.hidden` without changing `~/.aws/config`

#### Scenario: Revealing a previously hidden profile

- **WHEN** the user opens `Select Profiles...` and re-checks a hidden profile
- **THEN** that profile reappears under Cloud Profiles

#### Scenario: Hidden profiles persist across reloads

- **WHEN** the workspace is reloaded after hiding a profile
- **THEN** that profile is still hidden

### Requirement: Settings persistence target

All view-state writes (added regions, saved filters/views, hidden profiles, and the multi-select toggle) SHALL persist to Workspace settings when a workspace folder is open, and SHALL fall back to Global (User) settings when no workspace folder is open. Writing SHALL NOT fail when no folder is open.

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

The per-row actions in the Explore view SHALL be shown as inline action icons on the row (a hover toolbar) AND remain available in the row's right-click context menu. (VS Code only renders a tree row's `...` overflow alongside an inline action, so a row with no inline action has no `...` button at all; the actions are therefore contributed inline so they are always visible.) The inline icons SHALL be: an edit (pencil) icon for `Select Profiles...` (Cloud Profiles section row) and `Select Regions...` (profile row), a plus icon for `Add View...` (region rows), a trash icon for `Remove Region` (user-added region rows), and a pencil icon for `Edit View...` plus a trash icon for `Remove View` (saved-view rows). Each of these SHALL also be contributed as a non-inline `view/item/context` item so it appears in the right-click menu.

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

The system SHALL let the user remove a user-added region via a `Remove Region` action on that region row (an inline trash icon, also in the right-click context menu), removing only that one region from the workspace settings. The profile's configured default region SHALL always be shown and SHALL NOT offer a remove action.

#### Scenario: Removing a user-added region

- **WHEN** the user invokes Remove on a user-added region node
- **THEN** that single region is removed from the profile and from workspace settings, and other regions remain

#### Scenario: Default region cannot be removed

- **WHEN** the user views the profile's configured default region node
- **THEN** no remove action is offered for it

### Requirement: Add new view

The system SHALL let the user define a named filter via the `Add View...` action — invoked from a region row's inline plus icon (also in the right-click context menu) — by selecting a set of services. In the UX a saved filter is labeled a "view" (the actions are `Add View...`, `Edit View...`, `Remove View`); the underlying concept and the `localstack.cloudProfiles.filters` settings key are unchanged, and the remainder of this spec refers to the concept as a "filter" for continuity with the persisted model. By default a filter is scoped to the single region it was created under; the dialog SHALL offer an "apply to all regions" option that instead makes the filter available under every region of that profile. The filter SHALL appear as a focus selector scoped to the chosen services and SHALL be persisted per profile in the workspace settings with its scope.

#### Scenario: Creating a region-scoped filter

- **WHEN** the user invokes `Add View...` from a region's `...` menu, names it, selects one or more services, and leaves "apply to all regions" off
- **THEN** a new focus selector with that name appears under that region only and is saved with a single-region scope

#### Scenario: Creating a filter applied to all regions

- **WHEN** the user invokes `Add View...`, selects services, and enables "apply to all regions"
- **THEN** the filter appears under every region of that profile and is saved with an all-regions scope

#### Scenario: Selecting a filter scopes the Resources view to its services

- **WHEN** the user selects a saved filter focus selector
- **THEN** the Resources view shows only the services chosen for that filter

### Requirement: Edit and remove filters

The system SHALL let the user edit or remove a saved filter via `Edit View...` / `Remove View` actions on the filter row (inline pencil and trash icons, also in the right-click context menu). Editing SHALL reopen the filter wizard pre-populated with the filter's current name, services, and scope, and overwrite the saved filter with the new values. Removing SHALL delete the filter from the workspace settings.

#### Scenario: Editing a filter updates it

- **WHEN** the user invokes Edit on a filter, changes its services, and confirms
- **THEN** the filter's saved services are updated and the focus selector reflects the new scope

#### Scenario: Removing a filter deletes it

- **WHEN** the user invokes Remove on a filter
- **THEN** the filter no longer appears under any region and is deleted from workspace settings

### Requirement: Focus selectors drive the active focus

The system SHALL treat `View All Resources`, saved filters, and `CFN: <stack>` nodes as focus selectors. Selecting a focus selector SHALL compute its focus and set it as the active focus for the Resources view.

#### Scenario: Selecting a focus selector updates the Resources view

- **WHEN** the user clicks a focus selector
- **THEN** the Resources view re-renders to show the resources described by that selector's focus

### Requirement: Single- and multi-select behavior

The system SHALL default to single-select, where activating one focus selector deactivates any other. The system SHALL let the user enable multi-select, in which multiple focus selectors can be active simultaneously and their focuses are merged into one for the Resources view. The multi-select preference SHALL persist across reloads.

The toggle SHALL be accessible directly from the LocalStack view's title (`...`) menu — not only via the Settings UI. The menu SHALL show the action that applies to the current state (an enable action when off, a disable action when on). Toggling SHALL take effect immediately without requiring a window reload.

#### Scenario: Toggle is available in the view title menu

- **WHEN** the user opens the LocalStack view's `...` title menu while single-select is active
- **THEN** an "Enable multi-select" action is shown, and invoking it switches the view to multi-select immediately

#### Scenario: Single-select replaces the active focus

- **WHEN** multi-select is disabled and the user selects a second focus selector
- **THEN** only the newly selected focus is active and the Resources view reflects it alone

#### Scenario: Multi-select merges active focuses

- **WHEN** multi-select is enabled and the user activates two focus selectors
- **THEN** the Resources view shows the merged union of both focuses

#### Scenario: Preference persists across reloads

- **WHEN** the user enables multi-select and reloads the workspace
- **THEN** multi-select is still enabled
