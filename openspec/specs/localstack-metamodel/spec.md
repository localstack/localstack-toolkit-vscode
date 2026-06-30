# localstack-metamodel Specification

## Purpose
Translating the running emulator's `/_localstack/pods/state/metamodel` endpoint into a `Focus` for the LocalStack Instances section — naming the services and resource types actually present, scoped to the bundled LocalStack profile.

## Requirements
### Requirement: Compute a focus from the emulator metamodel

The `All Resources` selector under **LocalStack Instances** SHALL compute its focus from the running emulator's `/_localstack/pods/state/metamodel` endpoint, reached at the endpoint the Toolkit is configured to use (the `localstack` profile's `endpoint_url`) rather than a hardcoded URL. The payload is nested as account → service label → region → API operation → raw response. The system SHALL fetch that endpoint and translate (transpose) its JSON into a Focus that names the services and regions actually present in the emulator state, scoped to the bundled LocalStack profile.

#### Scenario: Metamodel is translated into a focus

- **WHEN** the user selects `All Resources` under LocalStack Instances and the emulator is running
- **THEN** the system fetches `/_localstack/pods/state/metamodel` and produces a focus listing the services and regions present in the returned state, with the service and region axes transposed into Focus order (profile → region → service)

#### Scenario: Only present services are named

- **WHEN** the metamodel reports state for a subset of services
- **THEN** the produced focus includes only those services (not every supported service)

### Requirement: Service-label mapping and unsupported-service filtering

The metamodel labels services in PascalCase (e.g. `CloudFormation`, `IAM`, `S3`). The system SHALL map each label to its manifest service-code id (case-insensitive, with a documented override table for exceptions such as Step Functions). Every service present in the metamodel that resolves to a manifest service **with a registered curated provider** SHALL be included in the produced focus — this includes services beyond the original seven, as their providers are added. The metamodel SHALL be used only to determine which services are *present* in the running instance; it SHALL NOT be used to determine which services are *supported* (that comes from the static manifest, see the `service-catalog` capability). A present service that resolves to no registered provider (e.g. not yet curated during rollout) SHALL be omitted and the omission SHALL be surfaced (e.g. via logging).

#### Scenario: PascalCase labels map to manifest ids

- **WHEN** the metamodel contains `CloudFormation` and `IAM`
- **THEN** the produced focus contains services with ids `cloudformation` and `iam`

#### Scenario: A present service with a curated provider appears

- **WHEN** the metamodel contains a service that has a registered curated provider (e.g. `S3` once S3 is curated)
- **THEN** that service is included in the produced focus

#### Scenario: A present but not-yet-curated service is omitted and logged

- **WHEN** the metamodel contains a service that resolves to no registered provider
- **THEN** that service is omitted from the focus and the omission is logged

### Requirement: Global-region and account handling

The system SHALL treat an empty-string region (`""`, the global-service mirror) as a duplicate of the same service's regional entries and SHALL NOT emit a region node with an empty id, while still representing a service that appears only under `""`. The system MAY assume a single account maps to the bundled LocalStack profile.

#### Scenario: Empty-string region is not rendered as a region node

- **WHEN** a service appears under both `us-east-1` and `""` with identical contents
- **THEN** the produced focus contains that service once under `us-east-1` and no region node with an empty id

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

### Requirement: Emulator unavailable handling

The system SHALL handle the emulator being unavailable or the metamodel request failing by surfacing a non-fatal error state rather than crashing the view.

#### Scenario: Emulator not running

- **WHEN** the user selects `All Resources` under LocalStack Instances while the emulator is not reachable
- **THEN** the Resources view shows an error or empty state and the rest of the LocalStack view remains usable
