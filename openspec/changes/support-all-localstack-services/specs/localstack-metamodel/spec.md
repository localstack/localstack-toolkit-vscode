## MODIFIED Requirements

### Requirement: Service-label mapping and unsupported-service filtering

The metamodel labels services in PascalCase (e.g. `CloudFormation`, `IAM`, `S3`). The system SHALL map each label to its manifest service-code id (case-insensitive, with a documented override table for exceptions such as Step Functions). Every service present in the metamodel that resolves to a manifest service **with a registered curated provider** SHALL be included in the produced focus — this includes services beyond the original seven, as their providers are added. The metamodel SHALL be used only to determine which services are *present* in the running instance; it SHALL NOT be used to determine which services are *supported* (that comes from the static manifest). A present service that resolves to no registered provider (e.g. not yet curated during rollout) SHALL be omitted and the omission SHALL be surfaced (e.g. via logging).

#### Scenario: PascalCase labels map to manifest ids

- **WHEN** the metamodel contains `CloudFormation` and `IAM`
- **THEN** the produced focus contains services with ids `cloudformation` and `iam`

#### Scenario: A present service with a curated provider appears

- **WHEN** the metamodel contains a service that has a registered curated provider (e.g. `S3` once S3 is curated)
- **THEN** that service is included in the produced focus

#### Scenario: A present but not-yet-curated service is omitted and logged

- **WHEN** the metamodel contains a service that resolves to no registered provider
- **THEN** that service is omitted from the focus and the omission is logged
