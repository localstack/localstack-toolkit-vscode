## 1. Context key & persistence

- [x] 1.1 Define a shared constant for the flag key `localstack.resourceBrowserEnabled` and small helpers to read it from `globalState` (default `false`)
- [x] 1.2 On `resource-browser` plugin activation, read the stored flag and `setContext("localstack.resourceBrowserEnabled", value)` before/at view registration

## 2. Gate the new views (package.json)

- [x] 2.1 Add `"when": "localstack.resourceBrowserEnabled"` to the `localstack.resources` view contribution
- [x] 2.2 Add `"when": "localstack.resourceBrowserEnabled"` to the `localstack.resourceDetails` view contribution
- [x] 2.3 Verify the Resource Details panel container auto-hides when its only view is gated off (no stray empty tab)

## 3. Enable/disable commands

- [x] 3.1 Add `localstack.enableResourceBrowser` and `localstack.disableResourceBrowser` to `contributes.commands`
- [x] 3.2 Hide both from the command palette (`commandPalette` `when: false`)
- [x] 3.3 Register both in `resource-browser.ts`: update `globalState`, `setContext`, then refresh the Explore provider

## 4. Mode-aware Explore tree

- [x] 4.1 Add `OptInTreeItem` and `OptOutTreeItem` classes in `src/views/explore/treeItems.ts`, each with a `command` and a fitting icon/label ("Enable/Disable resource browser (preview)")
- [x] 4.2 Construct `LocalStackViewProvider` with an `isResourceBrowserEnabled: () => boolean` getter
- [x] 4.3 Branch root `getChildren`: opted-out → `[LocalStack Instances, OptInNode]`; opted-in → `[LocalStack Instances, Cloud Profiles, Workspace IaC, OptOutNode]`
- [x] 4.4 Branch `makeInstanceChildren`: opted-out (running) → `[App Inspector]`; opted-in (running) → unchanged

## 5. Tests & verification

- [x] 5.1 Provider test: opted-out root shows only LocalStack Instances + opt-in node; opted-in root shows three sections + opt-out node
- [x] 5.2 Provider test: opted-out running instance omits `View: All Resources` and saved instance views; opted-in instance is unchanged
- [x] 5.3 `pnpm` build + lint + test green
- [x] 5.4 Manual smoke: toggle on/off, confirm Resources + Resource Details appear/disappear and the Explore tree re-renders without a reload
