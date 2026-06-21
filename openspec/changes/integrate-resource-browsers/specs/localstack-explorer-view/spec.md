## ADDED Requirements

### Requirement: Combined LocalStack tree view

The system SHALL provide a single tree view named "LocalStack" in the LocalStack activity-bar container with three top-level sections in this order: **LocalStack Instances**, **Cloud Profiles**, and **Workspace IaC**.

#### Scenario: Three sections are shown at the root

- **WHEN** the LocalStack view is rendered
- **THEN** exactly three top-level nodes appear: "LocalStack Instances", "Cloud Profiles", and "Workspace IaC"

### Requirement: LocalStack Instances section

Under **LocalStack Instances**, the system SHALL show an instance node labeled `AWS: <host:port>`, where the endpoint is derived from the endpoint the Toolkit is configured to use (the `localstack` profile's `endpoint_url` in `~/.aws/config`) rather than a hardcoded value. Its children are: a `Status` node reflecting the live emulator status, an `App Inspector` node that opens the App Inspector when clicked, and an `All Resources` focus selector.

#### Scenario: Instance node exposes status, app inspector, and a focus selector

- **WHEN** the LocalStack Instances section is expanded
- **THEN** the instance node shows a `Status` child, an `App Inspector` child, and an `All Resources` focus selector child

#### Scenario: Instance label reflects the configured endpoint

- **WHEN** the `localstack` profile's `endpoint_url` is `http://127.0.0.1:4566` (e.g. DNS rebind protection is active)
- **THEN** the instance node is labeled `AWS: 127.0.0.1:4566`, matching the endpoint the SDK and metamodel calls use, not a hardcoded `localhost.localstack.cloud:4566`

#### Scenario: Status reflects the running emulator

- **WHEN** the emulator status changes (e.g. stopped → running)
- **THEN** the `Status` node description updates to the new status without requiring a manual refresh

#### Scenario: App Inspector opens the existing webview

- **WHEN** the user clicks the `App Inspector` node
- **THEN** the existing App Inspector webview panel opens (behavior unchanged from before this change)

### Requirement: Cloud Profiles section

Under **Cloud Profiles**, the system SHALL show one node per AWS profile discovered in `~/.aws/config` (including `default` and the bundled `localstack` profile), labeled `AWS: <profile>`. Each profile SHALL show its configured default region plus any user-added regions; each region SHALL contain an `All Resources` focus selector, the filters applicable to that region, an `Add new filter` action, and one `CFN: <stack>` focus selector per active CloudFormation stack in that region. Each profile SHALL end with an `Add new region` action.

#### Scenario: Profiles are listed from AWS config

- **WHEN** the Cloud Profiles section is expanded and `~/.aws/config` defines profiles `default` and `staging`
- **THEN** nodes `AWS: default` and `AWS: staging` appear

#### Scenario: A region lists its focus selectors

- **WHEN** a profile's region is expanded
- **THEN** it shows `All Resources`, the filters applicable to that region, an `Add new filter` action, and one `CFN: <stack>` selector per active CloudFormation stack

#### Scenario: The bundled localstack profile is shown

- **WHEN** `~/.aws/config` includes the bundled `localstack` profile
- **THEN** an `AWS: localstack` node appears under Cloud Profiles, in addition to the LocalStack Instances section

#### Scenario: Invalid credentials surface an error node

- **WHEN** a profile cannot be queried (e.g. invalid credentials)
- **THEN** an error node is shown for that profile rather than failing the whole view

### Requirement: Workspace IaC placeholder

Under **Workspace IaC**, the system SHALL show a single placeholder child with the literal text `Coming soon`.

#### Scenario: Placeholder is shown

- **WHEN** the Workspace IaC section is expanded
- **THEN** a single non-interactive `Coming soon` node is shown

### Requirement: Add new region

The system SHALL let the user add one region at a time under a Cloud Profile via the `Add new region` action, choosing from a single-select list of regions not already shown for that profile, and SHALL persist added regions per profile in the workspace settings so they reappear on reload.

#### Scenario: Adding a region persists it

- **WHEN** the user clicks `Add new region` for a profile and selects a region
- **THEN** the region appears under that profile and is saved to workspace settings

#### Scenario: Added region survives reload

- **WHEN** the workspace is reloaded after a region was added
- **THEN** the previously added region is still shown under that profile

### Requirement: Remove a region

The system SHALL let the user remove a user-added region via a context-menu action on that region node, removing only that one region from the workspace settings. The profile's configured default region SHALL always be shown and SHALL NOT offer a remove action.

#### Scenario: Removing a user-added region

- **WHEN** the user invokes Remove on a user-added region node
- **THEN** that single region is removed from the profile and from workspace settings, and other regions remain

#### Scenario: Default region cannot be removed

- **WHEN** the user views the profile's configured default region node
- **THEN** no remove action is offered for it

### Requirement: Add new filter

The system SHALL let the user define a named filter via the `Add new filter` action by selecting a set of services. By default a filter is scoped to the single region it was created under; the dialog SHALL offer an "apply to all regions" option that instead makes the filter available under every region of that profile. The filter SHALL appear as a focus selector scoped to the chosen services and SHALL be persisted per profile in the workspace settings with its scope.

#### Scenario: Creating a region-scoped filter

- **WHEN** the user clicks `Add new filter` under a region, names it, selects one or more services, and leaves "apply to all regions" off
- **THEN** a new focus selector with that name appears under that region only and is saved with a single-region scope

#### Scenario: Creating a filter applied to all regions

- **WHEN** the user clicks `Add new filter`, selects services, and enables "apply to all regions"
- **THEN** the filter appears under every region of that profile and is saved with an all-regions scope

#### Scenario: Selecting a filter scopes the Resources view to its services

- **WHEN** the user selects a saved filter focus selector
- **THEN** the Resources view shows only the services chosen for that filter

### Requirement: Edit and remove filters

The system SHALL let the user edit or remove a saved filter via context-menu actions on the filter node. Editing SHALL reopen the filter wizard pre-populated with the filter's current name, services, and scope, and overwrite the saved filter with the new values. Removing SHALL delete the filter from the workspace settings.

#### Scenario: Editing a filter updates it

- **WHEN** the user invokes Edit on a filter, changes its services, and confirms
- **THEN** the filter's saved services are updated and the focus selector reflects the new scope

#### Scenario: Removing a filter deletes it

- **WHEN** the user invokes Remove on a filter
- **THEN** the filter no longer appears under any region and is deleted from workspace settings

### Requirement: Focus selectors drive the active focus

The system SHALL treat `All Resources`, saved filters, and `CFN: <stack>` nodes as focus selectors. Selecting a focus selector SHALL compute its focus and set it as the active focus for the Resources view.

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
