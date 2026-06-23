## MODIFIED Requirements

### Requirement: Resources view renders the active focus

The system SHALL provide a "Resources" tree view that renders the active focus as a hierarchy of profile → region → **service-and-resource-type** → resource (ARN). The service and resource type SHALL be combined into a single row rather than two nested levels: the row's label is the service name and its description (dimmed) is the resource type's plural name (e.g. label `SQS` / description `Queues`). A service with multiple resource types SHALL render one row per resource type, each sharing the service name (e.g. `Lambda — Functions` and `Lambda — Event Source Mappings`). When no focus is active, the view SHALL show a placeholder prompting the user to select a focus.

The combined service-and-resource-type row SHALL carry an icon that denotes the **target** of its profile, not the service: a LocalStack mark when the profile points at a LocalStack emulator, and a generic cloud icon when it points at real AWS. This icon SHALL appear on the combined row and SHALL NOT appear on the individual resource (ARN) leaves. A profile SHALL be treated as targeting LocalStack when it resolves to a custom/local endpoint (or is the synthetic `localstack` instance profile) and as targeting AWS otherwise. The system SHALL NOT bundle or display AWS-derived service icons.

#### Scenario: No focus shows a placeholder

- **WHEN** no focus selector has been activated
- **THEN** the Resources view shows a placeholder prompting the user to select a focus

#### Scenario: Active focus is rendered hierarchically

- **WHEN** a focus is active
- **THEN** the Resources view shows its profiles, and each profile expands to regions, then to combined service-and-resource-type rows, then to resources

#### Scenario: Service and resource type share one row

- **WHEN** a region contains the SQS service with its single `Queues` resource type
- **THEN** a single row labeled `SQS` with the dimmed description `Queues` is shown, and expanding it lists the queue ARNs (which carry no row icon)

#### Scenario: A multi-resource-type service renders one row per type

- **WHEN** a region contains Lambda (which has both Functions and Event Source Mappings)
- **THEN** two sibling rows appear — `Lambda` / `Functions` and `Lambda` / `Event Source Mappings` — each carrying the same target icon

#### Scenario: Empty resource types still appear

- **WHEN** a combined service-and-resource-type row has no resources
- **THEN** the row is still shown and expands to a `[ No Resources ]` placeholder

#### Scenario: LocalStack-targeted rows show the LocalStack mark

- **WHEN** a service-and-resource-type row belongs to a profile that targets a LocalStack emulator (a custom/local endpoint or the synthetic `localstack` instance profile)
- **THEN** the row's icon is the LocalStack mark, not an AWS-derived service icon

#### Scenario: AWS-targeted rows show a generic cloud icon

- **WHEN** a service-and-resource-type row belongs to a profile that targets real AWS (no custom endpoint)
- **THEN** the row's icon is a generic cloud icon, not an AWS-derived service icon
