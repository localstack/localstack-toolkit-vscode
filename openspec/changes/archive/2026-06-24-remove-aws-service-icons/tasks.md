## 1. Remove AWS-derived assets and API

- [x] 1.1 Delete the 6 AWS-derived SVGs in resources/icons/services/ (cloudformation, dynamodb, lambda, sns, sqs, states); remove the now-empty services/ directory if nothing else uses it
- [x] 1.2 Remove ServiceProvider.getIconPath(serviceId) from src/platforms/aws/services/serviceProvider.ts, along with the now-unused fs and path imports and the symbol-misc fallback (also removed the orphaned `context` plumbing through ServiceProvider/DeclarativeServiceProvider/ProviderFactory and its callers)
- [x] 1.3 Confirm no other references to getIconPath or resources/icons/services remain (grep)

## 2. Resolve the profile target

- [x] 2.1 In viewProvider.makeResourceProfiles, determine isLocalStack per profile from AWSConfig.getEndpointForProfile(profile.id) (custom/local endpoint, or synthetic `localstack` instance profile ⇒ LocalStack; otherwise AWS) via the isLocalStackProfile helper; getEndpointForProfile returns undefined on unresolvable config so it defaults to AWS and never throws
- [x] 2.2 Add an isLocalStack flag to ResourceProfileTreeItem; the service-type row reads it via its existing parent chain (parent.parent.isLocalStack), so no ResourceRegionTreeItem change was needed

## 3. Apply the target-aware icon

- [x] 3.1 In ResourceServiceTypeTreeItem, set iconPath to new ThemeIcon("localstack-logo") when the target is LocalStack and new ThemeIcon("cloud") when it is AWS, replacing the provider.getIconPath(...) call
- [x] 3.2 Verify the ARN leaf rows still carry no icon (ResourceArnTreeItem sets no iconPath)

## 4. Tests & verification

- [x] 4.1 Remove or update any existing tests that asserted per-service icon paths / getIconPath behavior (none existed — no-op)
- [x] 4.2 Add a test asserting a LocalStack-targeted row resolves to ThemeIcon id "localstack-logo" and an AWS-targeted row resolves to ThemeIcon id "cloud" (src/test/resources/treeItems.test.ts; plus getEndpointForProfile tests in awsConfig.test.ts)
- [x] 4.3 Run the full test suite (vscode-test) and confirm all pass (109 passing, 1 pre-existing pending)
- [x] 4.4 Launch the extension and visually confirm: LocalStack-profile rows show the LocalStack mark and AWS-profile rows show the cloud icon, under both a light and a dark theme — confirmed OK by user
- [x] 4.5 Grep the repo to confirm no AWS-derived icon assets remain referenced by the resource browser (no code refs; only LocalStack's own localstack.svg / localstack-icon PNG remain)
