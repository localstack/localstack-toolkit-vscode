# resource-browser Specification

## Purpose
The **Resources** and **Resource Details** views driven by the active focus, the target-aware (LocalStack vs AWS) row icon, and the AWS platform service providers that list and describe resources via the AWS SDK against a profile's endpoint.

## Requirements
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

### Requirement: Dynamic expansion of wildcard selectors

The system SHALL expand wildcard and default selectors in the active focus when rendering: wildcard profiles to all configured profiles, wildcard/default regions to the appropriate region set, wildcard services to **all manifest services that have a registered curated provider**, and wildcard ARNs to the resources actually present (listed via the service's curated provider). The resource tree SHALL remain flat (profile → region → service-and-resource-type → resource); resource types that are conceptually nested under another resource are still listed as flat, region-wide rows.

#### Scenario: Wildcard service node expands to curated services

- **WHEN** a region in the focus uses a wildcard service selector
- **THEN** expanding the region lists every manifest service that has a registered curated provider, each with its display name and icon

#### Scenario: Wildcard ARN node lists live resources

- **WHEN** a resource type uses a wildcard ARN selector
- **THEN** expanding it lists the actual resources of that type from the platform via the service's curated provider, or a placeholder when none exist

### Requirement: Resource Details view

The system SHALL provide a "Resource Details" view, rendered as a **webview** showing a key/value **table** of the resource currently selected in the Resources view, including at least its ARN and service, plus service-specific fields. The system SHALL obtain these fields via the AWS SDK `describeResource` path for the selected resource's service — directed at the profile's `endpoint_url` when present — for both LocalStack and real AWS cloud resources, so behavior is identical across the two. The system SHALL NOT source Resource Details from the LocalStack metamodel. The webview SHALL be self-contained (a strict Content-Security-Policy, no external resources) and SHALL match the active VS Code theme via theme CSS variables; field values SHALL be HTML-escaped. When no resource is selected, it SHALL show a placeholder; when `describeResource` fails, it SHALL show an error in place of the fields.

The table SHALL format values according to each field's `FieldType` (display only): `JSON` as a pretty-printed monospace block, `LONG_TEXT` as a wrapped monospace block, `ARN`/`LOG_GROUP` in a monospace cell, and `DATE`/`NUMBER`/`NAME`/`SHORT_TEXT` as plain text. Making these field types **interactive** (e.g. an `ARN` link that reveals the resource, a `LOG_GROUP` link, or "open in editor" for `JSON`/`LONG_TEXT`) is out of scope for this change and is deferred to future work; the webview foundation (which supports `command:` URIs and `postMessage`) is what enables it later.

The field (left) column SHALL occupy at most one third (33%) of the view width; a field label longer than that SHALL word-wrap within the column rather than expand it, so the value (right) column always retains at least two thirds of the width.

#### Scenario: Selecting a resource shows its details as a table

- **WHEN** the user selects a resource (ARN) in the Resources view
- **THEN** the Resource Details webview shows a table of that resource's ARN, service, and service-specific fields, themed to match VS Code

#### Scenario: Field types are formatted

- **WHEN** a described field has type `JSON` or `LONG_TEXT`
- **THEN** its value is rendered in a monospace block (JSON pretty-printed), rather than a single truncated line

#### Scenario: A long field label wraps within the capped column

- **WHEN** a described field's label is longer than one third of the view width
- **THEN** the label word-wraps within the field column, the field column stays at most 33% wide, and the value column keeps at least two thirds of the width

#### Scenario: Describe failure shows an error

- **WHEN** `describeResource` throws for the selected resource
- **THEN** the Resource Details view shows an error message rather than a stale or empty table

#### Scenario: Region-less resources can be described

- **WHEN** the selected resource has a region-less ARN (e.g. an S3 bucket `arn:aws:s3:::name`)
- **THEN** the SDK client for the describe call uses the profile's default region (or a built-in default) rather than an empty region, so the details load instead of failing with "Region is missing"

#### Scenario: Details come from the SDK for LocalStack and cloud alike

- **WHEN** the selected resource belongs to a LocalStack instance (profile with an `endpoint_url`)
- **THEN** the Resource Details fields are fetched via the SDK `describeResource` call directed at that endpoint, using the same code path as a real-AWS-cloud resource

#### Scenario: No selection shows a placeholder

- **WHEN** no resource is selected in the Resources view
- **THEN** the Resource Details view shows a placeholder prompting the user to select a resource

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

### Requirement: Profile node account label

In the Resources view, the profile node's description SHALL show the AWS account ID and, when present, the account alias, formatted `(<accountId> - <accountAlias>)`. When the account alias is empty, the description SHALL show `(<accountId>)` only — with no trailing ` - ` separator.

#### Scenario: Account alias is shown when present

- **WHEN** the selected profile's account has an alias `my-org`
- **THEN** the profile node description reads `(<accountId> - my-org)`

#### Scenario: Empty alias omits the separator

- **WHEN** the selected profile's account has no alias
- **THEN** the profile node description reads `(<accountId>)` with no trailing `-`

### Requirement: Resources view reflects edits to the active view

When the Resources view is showing a user-defined saved view (filter) and that view's definition is edited, the Resources view SHALL refresh to reflect the new definition without the user reselecting it. Saved-view focus selectors SHALL resolve their definition from current settings at selection/refresh time rather than from a snapshot captured when the tree was built. When the currently active saved view is removed, the Resources view SHALL revert to its no-focus placeholder.

#### Scenario: Editing the active view updates the Resources view

- **WHEN** a saved view is the active focus in the Resources view and the user edits that view's service/resource-type pairs
- **THEN** the Resources view refreshes to show the edited view's pairs without the user reselecting it

#### Scenario: Removing the active view clears the Resources view

- **WHEN** the active saved view is removed
- **THEN** the Resources view reverts to its placeholder prompting the user to select a focus

### Requirement: Manual refresh of the Resources and Resource Details views

The Resources and Resource Details views SHALL each provide a refresh action in the view's title bar. Invoking it SHALL re-fetch and re-render the view's current content — the Resources view against its active focus, and the Resource Details view against its currently selected resource — without requiring the user to re-select a focus or resource. Refreshing the Resources view SHALL **recompute** the active focus from its source rather than re-rendering a cached structure; for a LocalStack instance focus this means re-querying the metamodel API, so resources created since the focus was first selected appear.

#### Scenario: Refreshing the Resources view re-fetches the active focus

- **WHEN** the user clicks the refresh action in the Resources view title bar while a focus is active
- **THEN** the view re-queries the platform and re-renders the resources for that same focus

#### Scenario: Refreshing a LocalStack instance focus picks up new resources

- **WHEN** the active focus came from a LocalStack instance "All Resources" selector and a new resource has since been created in the emulator
- **THEN** clicking refresh re-queries the metamodel, recomputes the focus, and the new resource appears without the user re-selecting the focus selector

#### Scenario: Refreshing the Resource Details view re-fetches the selected resource

- **WHEN** the user clicks the refresh action in the Resource Details view title bar while a resource is selected
- **THEN** the view re-fetches and re-renders that resource's fields
