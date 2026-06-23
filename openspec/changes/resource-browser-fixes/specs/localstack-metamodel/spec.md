## MODIFIED Requirements

### Requirement: Live resource listing under the metamodel focus

The focus produced from the metamodel SHALL name only the resource types actually present in the metamodel for each service/region — determined from the metamodel's API-operation keys (each resource type maps to the list operation that signals its presence, e.g. SSM `describeParameters` → Parameters) — rather than expanding every present service to all of its registered resource types. The focus SHALL leave **ARN** selectors as wildcards so the AWS service providers list the live resource ARNs from the emulator on drill-down; only the resource-type axis is narrowed by the metamodel, not the ARN axis. When the metamodel reports an operation that cannot be mapped to a known resource type (or a resource type declares no operation), the system SHALL fall back to including that service's full resource-type set and SHALL log the gap, so a mapping gap never hides resources that exist.

#### Scenario: Only present resource types are named

- **WHEN** the metamodel reports a service with state for only some of its resource types (e.g. SSM with `describeParameters` but no document/maintenance-window/association/patch-baseline operations)
- **THEN** the produced focus includes only the present resource types (e.g. only `Parameters`), not every registered type of that service

#### Scenario: Drill-down lists live resources

- **WHEN** the metamodel-derived focus is rendered and a present service/resource type is expanded in the Resources view
- **THEN** the providers list the actual resource ARNs from the emulator endpoint

#### Scenario: Unmappable operation falls back to the full type set

- **WHEN** the metamodel reports an API operation for a present service that maps to no known resource type
- **THEN** that service's resource types are included as before (the full set) and the unmapped operation is logged, rather than the service's resources being hidden
