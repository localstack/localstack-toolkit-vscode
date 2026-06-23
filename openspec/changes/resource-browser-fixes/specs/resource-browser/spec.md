## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Resources view reflects edits to the active view

When the Resources view is showing a user-defined saved view (filter) and that view's definition is edited, the Resources view SHALL refresh to reflect the new definition without the user reselecting it. Saved-view focus selectors SHALL resolve their definition from current settings at selection/refresh time rather than from a snapshot captured when the tree was built. When the currently active saved view is removed, the Resources view SHALL revert to its no-focus placeholder.

#### Scenario: Editing the active view updates the Resources view

- **WHEN** a saved view is the active focus in the Resources view and the user edits that view's service/resource-type pairs
- **THEN** the Resources view refreshes to show the edited view's pairs without the user reselecting it

#### Scenario: Removing the active view clears the Resources view

- **WHEN** the active saved view is removed
- **THEN** the Resources view reverts to its placeholder prompting the user to select a focus
