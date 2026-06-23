## Why

The 6 service icons in the Resources view are hand-edited derivatives of AWS's Architecture Icons. Bundling AWS's iconography in our own commercial product risks violating AWS's icon terms of use, so we want them out of the codebase. The remaining 110 services already show a generic codicon, so removing the 6 derivatives also removes an inconsistency. Rather than leave service rows bare, we replace the per-service icon with a **target-aware** icon that carries no AWS intellectual property: it tells the user whether a row's resources live in a LocalStack emulator or in real AWS.

## What Changes

- **Remove all AWS-derived assets:** delete the 6 hand-edited SVGs in `resources/icons/services/` (`cloudformation`, `dynamodb`, `lambda`, `sns`, `sqs`, `states`).
- **Drop the per-service icon API:** remove `ServiceProvider.getIconPath(serviceId)` along with its now-unused `fs`/`path` imports and the `symbol-misc` fallback. The icon is no longer a property of the service.
- **Add a target-aware row icon:** the service-and-resource-type row shows `ThemeIcon("localstack-logo")` when its profile targets a LocalStack emulator and the built-in `ThemeIcon("cloud")` codicon when it targets real AWS. Both are themed icons (theme- and selection-aware) with no AWS-derived content.
- **Determine the target at the profile level:** in `viewProvider.makeResourceProfiles`, resolve whether a profile points at LocalStack via its `endpoint_url` (a custom/local endpoint, or the synthetic `localstack` instance profile, means LocalStack; no custom endpoint means AWS), set an `isLocalStack` flag on `ResourceProfileTreeItem`, and thread it down through `ResourceRegionTreeItem` to `ResourceServiceTypeTreeItem`.
- **Keep LocalStack's own marks untouched:** `resources/icons/localstack.svg`, `resources/fonts/localstack.woff`, and the `localstack-logo` `contributes.icons` glyph are LocalStack's own branding and remain.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `resource-browser`: the "Resources view renders the active focus" requirement changes so the combined service-and-resource-type row's icon denotes the **target** (LocalStack vs AWS) rather than the service, and explicitly forbids bundling AWS-derived service icons.

## Impact

- **Code:** `src/platforms/aws/services/serviceProvider.ts` (remove `getIconPath`); `src/views/resources/treeItems.ts` (`ResourceServiceTypeTreeItem` icon, thread `isLocalStack`); `src/views/resources/viewProvider.ts` (resolve target per profile); existing icon tests, if any.
- **Assets:** `resources/icons/services/*.svg` deleted (6 → 0). No new assets added.
- **No new dependencies.** `cloud` is a built-in codicon; `localstack-logo` is an already-registered font glyph (used in `status-bar.ts`).
- **Supersedes** the abandoned `service-icon-font` direction (do-not-bundle-AWS-icons reverses it).
