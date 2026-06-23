## MODIFIED Requirements

### Requirement: Dynamic expansion of wildcard selectors

The system SHALL expand wildcard and default selectors in the active focus when rendering: wildcard profiles to all configured profiles, wildcard/default regions to the appropriate region set, wildcard services to **all manifest services that have a registered curated provider**, and wildcard ARNs to the resources actually present (listed via the service's curated provider). The resource tree SHALL remain flat (profile → region → service-and-resource-type → resource); resource types that are conceptually nested under another resource are still listed as flat, region-wide rows.

#### Scenario: Wildcard service node expands to curated services

- **WHEN** a region in the focus uses a wildcard service selector
- **THEN** expanding the region lists every manifest service that has a registered curated provider, each with its display name and icon

#### Scenario: Wildcard ARN node lists live resources

- **WHEN** a resource type uses a wildcard ARN selector
- **THEN** expanding it lists the actual resources of that type from the platform via the service's curated provider, or a placeholder when none exist

### Requirement: AWS platform service providers

The system SHALL implement a curated AWS service provider for every service in the service manifest (see the `service-catalog` capability). Each provider SHALL list resource ARNs for a profile/region/resource-type and describe an individual resource's fields with a per-service custom field set. Providers MAY be authored declaratively or as imperative `ServiceProvider` subclasses; both SHALL talk to AWS via the AWS SDK using the profile's configuration, honoring a custom `endpoint_url` so the same providers work against the LocalStack emulator. There SHALL be no generic provider serving uncurated services. All AWS-specific code SHALL live under `src/platforms/aws/`.

#### Scenario: Provider lists resources for a wildcard type

- **WHEN** the Resources view expands a wildcard ARN node for a service with a registered provider
- **THEN** the corresponding AWS provider returns the live ARNs (or primary identifiers) for that profile, region, and resource type

#### Scenario: Provider describes a selected resource

- **WHEN** a resource of a curated service is selected
- **THEN** the corresponding AWS provider returns that resource's service-specific descriptive fields for the Resource Details view

#### Scenario: Providers honor a custom endpoint

- **WHEN** the selected profile defines an `endpoint_url` (e.g. the LocalStack endpoint)
- **THEN** the provider's SDK calls are directed to that endpoint

### Requirement: CloudFormation stack focus

The system SHALL compute a focus for a CloudFormation stack by querying the stack's resources and grouping them by service and resource type into the focus structure, so a `Stack: <stack>` selector scopes the Resources view to exactly that stack's resources. Resources whose service maps to a registered curated provider SHALL be shown under that service and resource type. A resource SHALL be skipped only when it cannot be represented — its service has no registered provider yet, or a required identifying field is absent — and any such skip SHALL be logged rather than aborting the whole stack.

#### Scenario: CFN selector scopes to stack resources

- **WHEN** the user selects a `Stack: <stack>` focus selector
- **THEN** the Resources view shows only the resources belonging to that CloudFormation stack, grouped by service and resource type

#### Scenario: Resources of curated services appear

- **WHEN** a CloudFormation stack contains resources whose service has a registered curated provider (e.g. `AWS::S3::Bucket` once S3 is curated)
- **THEN** those resources are shown under their service and resource type

#### Scenario: Unrepresentable resources are skipped and logged

- **WHEN** a stack resource cannot be represented (its service has no provider yet, or a required field is absent)
- **THEN** that single resource is skipped and the skip is logged, while every representable resource in the stack is still shown
