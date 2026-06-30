## ADDED Requirements

### Requirement: Focus data structure

The system SHALL represent a "focus" as a hierarchical structure of profiles → regions → services → resource types → ARNs. A focus SHALL carry a `version` string and a list of profiles; each profile SHALL have an `id` and a list of regions; each region SHALL have an `id` and a list of services; each service SHALL have an `id` and a list of resource types; each resource type SHALL have an `id` and a list of ARN strings. The structure SHALL be validated against a schema before use.

#### Scenario: Valid focus is accepted

- **WHEN** a focus object matching the schema (version, profiles, regions, services, resource types, arns) is parsed
- **THEN** parsing succeeds and the typed focus object is returned

#### Scenario: Malformed focus is rejected

- **WHEN** a focus object missing required fields or with mistyped fields is parsed
- **THEN** parsing fails with a descriptive validation error and no focus is returned

### Requirement: Wildcard and default selectors

The system SHALL support wildcard (`*`) selectors for profiles, regions, services, resource types, and ARNs, and a `default` selector for regions. A wildcard at a level SHALL mean "expand dynamically to all available items at that level when rendered"; a `default` region SHALL mean "the profile's configured default region". Non-wildcard ids SHALL be used literally.

#### Scenario: Wildcard service expands to all supported services

- **WHEN** a region's services list contains exactly one service with id `*`
- **THEN** consumers SHALL expand it to every supported service provider, each with wildcard resource types and ARNs

#### Scenario: Default region resolves to the profile's configured region

- **WHEN** a profile's regions list contains exactly one region with id `default`
- **THEN** consumers SHALL resolve it to the region configured for that profile, or surface an error if none is configured

#### Scenario: Wildcard ARN triggers live listing

- **WHEN** a resource type's arns list is exactly `["*"]`
- **THEN** consumers SHALL list the actual ARNs from the platform rather than using literal values
