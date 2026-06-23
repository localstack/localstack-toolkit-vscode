## Why

The resource browser only understands seven AWS services (`cloudformation`, `dynamodb`, `iam`, `lambda`, `sns`, `sqs`, `states`) because each is a hand-written provider in `ProviderFactory`. The ~110 other services LocalStack supports are invisible: dropped from the "All Resources" metamodel view, skipped when listing a CloudFormation stack's resources, and impossible to drill into or inspect. The browser should reflect the **full, published set of services LocalStack supports**, and every one of them should be a real, curated provider — knowing its resource types, how to list live resources, and which fields to show in Resource Details.

## What Changes

- **Add a static service manifest** generated from LocalStack's published coverage data (`localstack-docs/src/data/coverage/*.json`, 117 services). It enumerates every supported service and its community/pro availability. The manifest is the source of truth for "which services exist." The system SHALL NOT query a running emulator (`/_localstack/health`) or any discovery API (e.g. Cloud Control) to decide what is supported.
- **Every supported service gets a curated provider** that lists its resource types, lists live resources for a profile/region/type, and describes a single resource with a **per-service, custom set of detail fields**. There is **no** generic/fallback provider tier and no Cloud Control listing.
- **Introduce a declarative provider format + engine** so curating ~117 services is tractable: each service is described as data (resource types, list call + identifier, CFN mapping, and the exact detail fields). The engine executes these definitions; the existing `ServiceProvider` class remains as an escape hatch for services with unusual behavior. Functionality is identical to a hand-written provider.
- **Resource types are a per-service curation decision.** The coverage data enumerates API operations, not resource types, so each provider declares its resource types (bootstrapped from `List*`/`Describe*` operation pairs, human-confirmed). The resource tree stays **flat** (service → resource type → resource); cross-resource hyperlinks are deferred.
- **Show all CloudFormation stack resources** whose service has a curated provider; a resource is skipped (logged) only when genuinely unrepresentable or its service is not yet curated.
- **Identify all present services in "All Resources."** The metamodel view maps service labels to manifest service ids (using AWS's own service codes, e.g. `cognito-idp`, `states`) and shows every present service that has a curated provider.
- **Completeness is the definition of done**, enforced by a test that every manifest service has a registered provider. Because 117 services cannot land at once, delivery is **batched**: the engine + a parity migration of the existing 7 providers, then Batch 1 of 10 popular services (≤5 resource types each), then subsequent batches until the completeness test is green.

## Capabilities

### New Capabilities
- `service-catalog`: The static, coverage-derived service manifest (provenance, generation, AWS-service-code ids); the requirement that every manifest service has a curated provider (no generic tier, no runtime discovery); and the declarative provider format/engine used to author them.

### Modified Capabilities
- `resource-browser`: Wildcard service expansion lists all manifest services that have a curated provider; every service is served by a curated provider (generic-provider language removed); CloudFormation stack listing renders all resources of curated services and skips/logs only the unrepresentable or not-yet-curated ones.
- `localstack-metamodel`: "All Resources" maps metamodel labels to manifest service ids and shows every present service that has a curated provider, logging any present service not yet curated (transitional during rollout).

## Impact

- **New code**: a service manifest (generated JSON + loader) and a generator script; a declarative provider format + execution engine; per-service declarative definitions and SDK client wrappers.
- **Modified code**: `ProviderFactory` (manifest-backed registration of curated/declarative providers, completeness check), `metamodelFocus` (manifest-id mapping), `cfnStackModel` (map curated resources; skip/log otherwise), and the existing 7 providers (migrated to the declarative format for parity).
- **Data sources**: LocalStack's published coverage data (`localstack-docs`) for the service set; AWS SDK per-service `List*`/`Describe*` calls for live resources (honoring `endpoint_url`); CloudFormation resource-type reference for resource-type selection. No runtime service-discovery calls.
- **Dependencies**: additional `@aws-sdk/client-*` packages for the newly covered services.
- **Tests**: manifest loading, completeness (every manifest service has a provider), declarative-engine execution, parity of the migrated 7, and per-service list/describe/CFN mapping for Batch 1.
