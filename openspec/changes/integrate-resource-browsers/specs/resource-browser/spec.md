## ADDED Requirements

### Requirement: Resources view renders the active focus

The system SHALL provide a "Resources" tree view that renders the active focus as a hierarchy of profile → region → service → resource type → resource (ARN). When no focus is active, the view SHALL show a placeholder prompting the user to select a focus.

#### Scenario: No focus shows a placeholder

- **WHEN** no focus selector has been activated
- **THEN** the Resources view shows a placeholder prompting the user to select a focus

#### Scenario: Active focus is rendered hierarchically

- **WHEN** a focus is active
- **THEN** the Resources view shows its profiles, and each profile expands to regions, services, resource types, and resources in turn

### Requirement: Dynamic expansion of wildcard selectors

The system SHALL expand wildcard and default selectors in the active focus when rendering: wildcard profiles to all configured profiles, wildcard/default regions to the appropriate region set, wildcard services to all supported service providers, and wildcard ARNs to the resources actually present (listed via the platform).

#### Scenario: Wildcard service node expands to supported services

- **WHEN** a region in the focus uses a wildcard service selector
- **THEN** expanding the region lists every supported service provider

#### Scenario: Wildcard ARN node lists live resources

- **WHEN** a resource type uses a wildcard ARN selector
- **THEN** expanding it lists the actual resource ARNs of that type from the platform, or a placeholder when none exist

### Requirement: Resource Details view

The system SHALL provide a "Resource Details" tree view that shows the details of the resource currently selected in the Resources view, including at least its ARN and service, plus service-specific fields. The system SHALL obtain these fields via the AWS SDK `describeResource` path for the selected resource's service — directed at the profile's `endpoint_url` when present — for both LocalStack and real AWS cloud resources, so behavior is identical across the two. The system SHALL NOT source Resource Details from the LocalStack metamodel. When no resource is selected, it SHALL show a placeholder.

#### Scenario: Selecting a resource shows its details

- **WHEN** the user selects a resource (ARN) in the Resources view
- **THEN** the Resource Details view shows that resource's ARN, service, and service-specific fields

#### Scenario: Details come from the SDK for LocalStack and cloud alike

- **WHEN** the selected resource belongs to a LocalStack instance (profile with an `endpoint_url`)
- **THEN** the Resource Details fields are fetched via the SDK `describeResource` call directed at that endpoint, using the same code path as a real-AWS-cloud resource

#### Scenario: No selection shows a placeholder

- **WHEN** no resource is selected in the Resources view
- **THEN** the Resource Details view shows a placeholder prompting the user to select a resource

### Requirement: AWS platform service providers

The system SHALL implement AWS service providers (for at least CloudFormation, DynamoDB, IAM, Lambda, SNS, SQS, and Step Functions) that list resource ARNs for a profile/region/resource-type and describe an individual resource's fields. Providers SHALL talk to AWS via the AWS SDK using the profile's configuration, honoring a custom `endpoint_url` so the same providers work against the LocalStack emulator. All AWS-specific code SHALL live under `src/platforms/aws/`.

#### Scenario: Provider lists resources for a wildcard type

- **WHEN** the Resources view expands a wildcard ARN node for a supported service
- **THEN** the corresponding AWS provider returns the live ARNs for that profile, region, and resource type

#### Scenario: Provider describes a selected resource

- **WHEN** a resource of a supported service is selected
- **THEN** the corresponding AWS provider returns the resource's descriptive fields for the Resource Details view

#### Scenario: Providers honor a custom endpoint

- **WHEN** the selected profile defines an `endpoint_url` (e.g. the LocalStack endpoint)
- **THEN** the provider's SDK calls are directed to that endpoint

### Requirement: CloudFormation stack focus

The system SHALL compute a focus for a CloudFormation stack by querying the stack's resources and grouping them by service and resource type into the focus structure, so a `CFN: <stack>` selector scopes the Resources view to exactly that stack's resources.

#### Scenario: CFN selector scopes to stack resources

- **WHEN** the user selects a `CFN: <stack>` focus selector
- **THEN** the Resources view shows only the resources belonging to that CloudFormation stack, grouped by service and resource type
