## ADDED Requirements

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
