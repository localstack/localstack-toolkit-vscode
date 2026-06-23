## 1. Fix S3 / region-less describe (#1)

- [x] 1.1 In AWSConfig.getClientConfig, fall back to getRegionForProfile(profile) then "us-east-1" when region is empty/undefined; keep listing behavior unchanged (it always passes a real region)
- [x] 1.2 Add a test asserting getClientConfig fills a default region when none is given, and leaves a provided region intact
- [ ] 1.3 Manually/automatically verify an S3 bucket's details load instead of erroring "Region is missing" — runtime smoke, see §7.3

## 2. Cap the Resource Details first column (#2)

- [x] 2.1 In src/views/resource-details/viewProvider.ts STYLES: set table to table-layout:fixed; td.field { width:33%; white-space:normal; overflow-wrap:break-word; }; td.value { width:67% }
- [ ] 2.2 Verify a long field label wraps within the 33% column and the value keeps ~two thirds of the width — runtime smoke, see §7.3

## 3. Remove multi-select (#3)

- [x] 3.1 package.json: remove the localstack.focus.multiSelect setting, the enableMultiSelect/disableMultiSelect commands, their view/title menu entries, and references to the localstack.multiSelect context key
- [x] 3.2 resource-browser.ts: remove createLocalStackView/recreateLocalStackView/setMultiSelect and the enable/disable command registrations; register the instances tree once with canSelectMany:false and a single selection listener
- [x] 3.3 LocalStackViewProvider.computeFocus: return the single selected focus selector's focus (no mergeFocuses); still return undefined when no focus selector is selected
- [x] 3.4 Remove mergeFocuses from src/models/focus.ts and delete its tests in src/test/models/focus.test.ts
- [x] 3.5 Run tsc + lint; confirm no dangling references to multiSelect/mergeFocuses (tsc clean; grep finds none)

## 4. Refresh Resources view on view edit (#4)

- [x] 4.1 Make FilterTreeItem focus producers resolve the saved filter live by (profile, name) from settings at selection/refresh time instead of capturing the SavedFilter snapshot (extracted resolveRegionFilterFocus; getFocus widened to Promise<Focus|undefined>)
- [x] 4.2 Thread the ResourceViewProvider (or a refresh callback) into registerLocalStackCommands (refreshResources callback)
- [x] 4.3 After saveFilter (add/edit) and removeFilter, refresh the Resources view; ensure removing the active view reverts Resources to its placeholder (applyFocus clears on forced refresh yielding undefined)
- [x] 4.4 Add a test that editing the active view's pairs changes the focus the producer yields (live resolution), and removing it yields no focus (regionFilterFocus.test.ts)

## 5. Metamodel focus names only present resource types (#6)

- [x] 5.1 Add a metamodel list-operation name to each resource type: extended defineService types with optional metamodelOp; annotated all multi-type declarative defs (ssm, events, kinesis, kms, logs, apigateway). Single op per type; single-type services rely on fallback
- [x] 5.2 Add a ServiceProvider accessor (getMetamodelOperationMap, default empty); declarative engine builds it from metamodelOp annotations; imperative multi-type providers (Lambda, States) override directly. Single-type imperative providers use the empty-map fallback (correct: one type)
- [x] 5.3 In metamodelFocus.metamodelToFocus, build resource types per service/region from the metamodel's API-operation keys, mapping ops→types via operationMaps; keep arns:["*"]
- [x] 5.4 Fallback: when a present operation maps to no known type (or provider declares no map), include that service's full type set and log the gap
- [x] 5.5 metamodelFocus tests: only-present-types (SSM describeParameters → only Parameters); unmapped op falls back to full set; existing tests updated for the new signature
- [ ] 5.6 Verify: with only an SSM Parameter in the emulator, "View: All Resources" shows only SSM Parameters — runtime smoke, see §7.3

## 6. Views in the LocalStack Instances section (#5, builds on §5)

- [x] 6.1 settings.ts: store/read instance views under a DEDICATED key `localstack.instanceViews` (not the cloudProfiles.filters map — avoids collision with the bundled localstack cloud profile; see design.md deviation). Added getInstanceViews/saveInstanceView/removeInstanceView + package.json setting
- [x] 6.2 commands.ts: added addInstanceView/editInstanceView/removeInstanceView; runFilterWizard gained an isInstance mode that omits the region-scope step and checks name uniqueness among instance views
- [x] 6.3 viewProvider.ts (localstack): makeInstanceChildren renders saved instance views as InstanceViewTreeItem focus selectors; focus = intersectMetamodelWithPairs(computeMetamodelFocus, chosen pairs), resolved live by name
- [x] 6.4 treeItems.ts: added InstanceViewTreeItem with contextValue "localstackInstanceView" (distinct from localstackFilter)
- [x] 6.5 package.json: Add View on the instance node (viewItem == localstackInstance), Edit/Remove on instance view items (viewItem == localstackInstanceView), inline + context; commandPalette hides
- [x] 6.6 Added intersectMetamodelWithPairs test (instanceViewFocus.test.ts): chosen pairs filter the metamodel; undeployed pairs dropped; empty services/regions pruned

## 7. Verification

- [x] 7.1 Run the full test suite (vscode-test) and confirm all pass (116 passing, 1 pre-existing pending)
- [x] 7.2 Run tsc + lint clean (tsc: no errors; eslint: changed files clean — the 2 commands.ts floating-promise warnings are pre-existing showInformationMessage calls, not introduced here)
- [ ] 7.3 Manual smoke: S3 details load; long labels wrap; no multi-select toggle; editing an active view refreshes Resources; "View: All Resources" shows only present resource types (SSM Parameters only); add/edit/remove instance views work and intersect the metamodel — MANUAL: requires running the extension; not performed by the agent
