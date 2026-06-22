## Why

The LocalStack Toolkit today shows only a minimal "LocalStack" tree (instance status + an App Inspector launcher). The separate **AWS Inspector** extension already implements a full resource-browsing experience — a Focus view, a Resources tree, and a Resource Details panel backed by AWS SDK service providers. Merging that functionality into the Toolkit gives users a single sidebar where they can browse the resources running in their local emulator *and* in their real AWS cloud profiles, without installing or context-switching between two extensions.

This is also the moment to generalize: the Toolkit should be structured so that AWS is one *platform* among future (non-AWS) emulators, rather than hard-coding AWS throughout.

## What Changes

- **Add two new tree views** to the existing LocalStack activity-bar container: **Resources** and **Resource Details** (ported from AWS Inspector, behavior unchanged).
- **Replace** the current minimal LocalStack instances tree with a richer **"LocalStack" view** that combines the existing instance node with AWS Inspector's "Focus" concept. Its structure:
  - **LocalStack Instances** → `AWS: localhost.localstack.cloud:4566` → `Status`, `App Inspector`, and an `All Resources` focus selector.
  - **Cloud Profiles** → one node per AWS profile from `~/.aws/config` → one node per user-added region (plus the profile's default region) → `All Resources`, any saved filters, an `Add new filter` action, and one `CFN: <stack>` selector per CloudFormation stack; each profile ends with an `Add new region` action.
  - **Workspace IaC** → a `Coming soon` placeholder.
- **Introduce "Focus Selectors"**: leaf nodes (`All Resources`, `<Filter>`, `CFN: …`) that, when clicked, set the active Focus driving the Resources view.
  - `All Resources` under **LocalStack Instances** is computed from the emulator's `/_localstack/pods/state/metamodel` endpoint (names the services/regions actually present; ARNs left as wildcards so providers list live resources).
  - `All Resources` under **Cloud Profiles** uses wildcard service/region selectors for interactive drill-down.
  - `CFN: …` is derived by querying the CloudFormation stack's resources (ported from AWS Inspector).
- **Add user-defined filters** (`Add new filter`): pick a set of services to scope a focus selector; persisted in workspace settings.
- **Add dynamic regions** (`Add new region`): pick a region to add under a profile; persisted in workspace settings.
- **Add multi-select** for focus selectors: single-select by default; an opt-in setting lets multiple selectors be active at once, merged into one Focus.
- **Relocate all AWS-specific code** (SDK clients, service providers, ARN/region/CloudFormation models) under `src/platforms/aws/` so future emulators can add `src/platforms/<name>/`.
- **Add dependencies**: `@aws-sdk/client-*` (account, cloudformation, dynamodb, iam, lambda, sfn, sns, sqs, sts) and `js-ini`.

## Capabilities

### New Capabilities
- `focus-model`: The Focus data structure (profiles → regions → services → resource types → ARNs), its wildcard/`default` semantics, and the merging of multiple selected focuses into one.
- `localstack-explorer-view`: The combined "LocalStack" tree view — its three sections, focus selectors, user-added regions and filters persisted to workspace settings, and the single/multi-select behavior.
- `resource-browser`: The Resources and Resource Details views driven by the active focus, plus the AWS platform service providers that list and describe resources via the AWS SDK against a profile's endpoint.
- `localstack-metamodel`: Translating the emulator's pods-state metamodel endpoint into a Focus for the LocalStack Instances section.

### Modified Capabilities
<!-- None: openspec/specs/ is empty; this is the first set of specs. -->

## Impact

- **New views/commands/settings** in `package.json` (`contributes.views`, `commands`, `configuration`).
- **Replaces** `src/plugins/app-inspector-webview.ts`'s `InstancesTreeDataProvider` with the new LocalStack explorer; the App Inspector webview launcher is preserved.
- **New code** under `src/platforms/aws/` (clients, services, models) and `src/views/` (focus/resources/resource-details), ported from AWS Inspector and adapted to the Toolkit's plugin system, kebab-case file naming, tab indentation, and `node:`/`.ts` import conventions.
- **New dependencies**: nine `@aws-sdk/client-*` packages + `js-ini`, bundled by the existing esbuild config.
- **Tests**: port AWS Inspector's model/view tests; add tests for the metamodel→Focus translation, filter/region persistence, and multi-select merging (mocha + `@vscode/test-cli`).
