# localstack-metamodel Specification

## Purpose
TBD - created by archiving change integrate-resource-browsers. Update Purpose after archive.
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

The metamodel labels services in PascalCase (e.g. `CloudFormation`, `IAM`, `S3`). The system SHALL map each label to its internal provider id, and SHALL omit any service that has no registered `ServiceProvider` from the produced focus. The system SHALL surface (e.g. via logging) which present services were omitted for lack of a provider.

#### Scenario: PascalCase labels map to provider ids

- **WHEN** the metamodel contains `CloudFormation` and `IAM`
- **THEN** the produced focus contains services with ids `cloudformation` and `iam`

#### Scenario: Unsupported services are omitted

- **WHEN** the metamodel contains a service with no registered provider (e.g. `S3`)
- **THEN** that service is omitted from the focus and the omission is logged

### Requirement: Global-region and account handling

The system SHALL treat an empty-string region (`""`, the global-service mirror) as a duplicate of the same service's regional entries and SHALL NOT emit a region node with an empty id, while still representing a service that appears only under `""`. The system MAY assume a single account maps to the bundled LocalStack profile.

#### Scenario: Empty-string region is not rendered as a region node

- **WHEN** a service appears under both `us-east-1` and `""` with identical contents
- **THEN** the produced focus contains that service once under `us-east-1` and no region node with an empty id

### Requirement: Live resource listing under the metamodel focus

The focus produced from the metamodel SHALL leave resource-type and ARN selectors as wildcards so the AWS service providers list the live resources from the emulator on drill-down, rather than relying on the metamodel for individual ARNs.

#### Scenario: Drill-down lists live resources

- **WHEN** the metamodel-derived focus is rendered and a service/resource type is expanded in the Resources view
- **THEN** the providers list the actual resource ARNs from the emulator endpoint

### Requirement: Emulator unavailable handling

The system SHALL handle the emulator being unavailable or the metamodel request failing by surfacing a non-fatal error state rather than crashing the view.

#### Scenario: Emulator not running

- **WHEN** the user selects `All Resources` under LocalStack Instances while the emulator is not reachable
- **THEN** the Resources view shows an error or empty state and the rest of the LocalStack view remains usable

