## Context

The Resources view sets a service icon on each combined service-and-resource-type row via `ServiceProvider.getIconPath(serviceId)` ([serviceProvider.ts:104-122](../../../src/platforms/aws/services/serviceProvider.ts)), called from `ResourceServiceTypeTreeItem` ([treeItems.ts:75](../../../src/views/resources/treeItems.ts)). `getIconPath` returns the path to a bundled per-service SVG when one exists, else a `symbol-misc` codicon. Only 6 SVGs exist, and all 6 are hand-edited derivatives of AWS's Architecture Icons. Shipping AWS's iconography in our product is a terms-of-use concern, so they must be removed.

The supporting infrastructure makes a clean replacement easy: the view already resolves per-profile context in `viewProvider.makeResourceProfiles` ([viewProvider.ts:150](../../../src/views/resources/viewProvider.ts)) (STS caller identity + IAM alias), `AWSConfig.getSectionForProfile(profile.id)?.endpoint_url` already exposes a profile's endpoint, the LocalStack-backed instance focus is a synthetic profile named `localstack`, and the LocalStack logo is already a registered, themeable font glyph (`localstack-logo` in `contributes.icons`, used as `$(localstack-logo)` in [status-bar.ts:99](../../../src/plugins/status-bar.ts)). The tree rows form a parent chain (service-type → region → profile), so a profile-level fact can be threaded down to the row.

## Goals / Non-Goals

**Goals:**
- Remove every AWS-derived icon asset and the per-service icon API from the codebase.
- Give each service row a meaningful, AWS-IP-free icon that signals where its resources live (LocalStack vs AWS).
- Reuse existing, already-themed icons (`localstack-logo` glyph, built-in `cloud` codicon) — no new assets, no new dependencies.

**Non-Goals:**
- Restoring distinct per-service iconography (explicitly out — that's what we're removing). Per-service art could only return later as LocalStack's own original work; not in scope here.
- Changing the tree hierarchy, resource listing, or details view.
- Touching LocalStack's own marks (`localstack.svg`, `localstack.woff`, the `localstack-logo` glyph).

## Decisions

### Decision: Icon denotes the profile target, not the service

The icon moves from a per-service property to a per-profile-target property. A row under a LocalStack-targeted profile shows `ThemeIcon("localstack-logo")`; a row under an AWS-targeted profile shows `ThemeIcon("cloud")` (a built-in codicon). Both are `ThemeIcon`s, so they inherit theme foreground color and selection inversion for free, and neither bundles AWS content. Alternative considered: a single neutral codicon for every row (simplest), rejected because the target signal is more useful and costs little given the profile context is already resolved. Alternative considered: no icon at all, rejected because it loses row alignment/visual anchor for no benefit.

### Decision: LocalStack-vs-AWS signal is the profile's custom endpoint

A profile targets LocalStack when it resolves to a custom/local endpoint — `AWSConfig.getSectionForProfile(profile.id)?.endpoint_url` is set — or when it is the synthetic `localstack` instance profile. Otherwise it targets real AWS. Rationale: the configured `localstack` profile is written with `endpoint_url = http://localhost.localstack.cloud:4566` ([configure-aws.ts:79](../../../src/utils/configure-aws.ts)), and real AWS profiles have no custom endpoint. This is a binary, dependency-free check. Trade-off: a user who points a profile at some *non-LocalStack* custom endpoint would also get the LocalStack mark. Accepted as a rare edge case; optionally refine later by matching the endpoint host against a `localstack`/`localhost` pattern rather than mere presence.

### Decision: Resolve once per profile, thread the flag down

Compute `isLocalStack` in `makeResourceProfiles` (where profile context already exists) and store it on `ResourceProfileTreeItem`. `ResourceServiceTypeTreeItem` reads it via its parent chain (`parent.parent`) — or it is passed explicitly through `ResourceRegionTreeItem` — and selects the icon in its constructor, replacing the `provider.getIconPath(...)` call. This keeps endpoint resolution out of the per-row hot path and off `ServiceProvider`.

### Decision: Delete `getIconPath` rather than repurpose it

`getIconPath` is removed entirely (with its `fs`/`path` imports and `symbol-misc` fallback) because the icon is no longer derivable from a service id. Keeping a stubbed method would invite re-introducing AWS assets. `ServiceProvider` returns to being purely about resource data.

## Risks / Trade-offs

- **Misclassifying a custom non-LocalStack endpoint as LocalStack** → Accepted edge case; mitigated optionally by host-pattern matching on the endpoint URL.
- **Profiles whose endpoint can't be resolved** (error rows already handled by `ResourceErrorTreeItem`) → target resolution must default safely (treat unknown as AWS/cloud) and never throw in the row constructor.
- **Visual regression for users who valued per-service icons** → Intentional; communicated by the proposal's rationale. The target icon is arguably more informative for a tool that spans local and cloud.
- **Residual AWS-derived assets elsewhere** (READMEs, marketplace art, appinspector webview) → Out of scope for this change but worth a follow-up sweep; this change covers the resource-browser service icons only.

## Migration Plan

1. Delete the 6 SVGs in `resources/icons/services/`.
2. Add target resolution in `viewProvider.makeResourceProfiles`; store `isLocalStack` on `ResourceProfileTreeItem`.
3. Thread the flag to `ResourceServiceTypeTreeItem`; set `iconPath` to `localstack-logo` or `cloud` accordingly.
4. Remove `ServiceProvider.getIconPath` and its now-unused imports.
5. Update/remove icon-related tests; add coverage that a LocalStack-targeted row and an AWS-targeted row select the expected ThemeIcon ids.

Rollback: restore `getIconPath` and the SVGs from git history; the change is self-contained.

## Open Questions

- Refine the LocalStack signal to host-pattern matching (`localstack`/`localhost`) now, or keep the simpler "any custom endpoint ⇒ LocalStack" until a real misclassification is reported?
- Is `cloud` the best AWS-side codicon, or a more neutral one (e.g. `cloud-upload` is wrong; `cloud` reads as generic cloud)? Confirm against the codicon set during apply.
