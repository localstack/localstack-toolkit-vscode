## Why

The `integrate-resource-browser` change replaced the minimal "LocalStack" tree with a full three-view resource-browsing experience (the **Explore** tree's three sections, plus the **Resources** and **Resource Details** views). That experience is a significant departure from what existing users know, and we want to ship it as an opt-in preview rather than flipping everyone over at once.

Users SHALL start in an experience equivalent to the original Toolkit — a single **Explore** view showing only the **LocalStack Instances** entry (instance status + `App Inspector`) — and SHALL be able to opt in to the full resource browser from a link inside that view. Opting in reveals all three sections and the two additional views; opting back out restores the minimal experience. The choice is remembered per user.

## What Changes

- **Add an opt-in flag** `localstack.resourceBrowserEnabled`, persisted in the extension's `globalState` (per user, across all workspaces) and mirrored to a VS Code context key of the same name on every activation so view visibility survives reloads.
- **Gate the two new views** — `localstack.resources` and `localstack.resourceDetails` — behind `when: localstack.resourceBrowserEnabled`. The **Explore** view and the activity-bar container are never gated. The Resource Details panel container auto-hides when its only view is hidden.
- **Make the Explore tree mode-aware**:
  - **Opted out (default)** — the Explore view shows only the **LocalStack Instances** section. The instance node shows its status line and, when running, the `App Inspector` node only — no `View: All Resources` selector and no saved instance views (those drive the now-hidden Resources view). A trailing **opt-in node** ("Enable resource browser (preview)") invites the user in.
  - **Opted in** — the Explore view shows all three sections (**LocalStack Instances**, **Cloud Profiles**, **Workspace IaC**) and the instance node regains its `View: All Resources` selector and saved instance views, exactly as today. A trailing **opt-out node** ("Disable resource browser (preview)") lets the user leave.
- **Add two commands** — `localstack.enableResourceBrowser` and `localstack.disableResourceBrowser` — that flip the flag, update the context key, and refresh the Explore tree. They are wired to the opt-in/opt-out tree nodes (not exposed in the command palette).

## Capabilities

### Modified Capabilities
- `localstack-explorer-view`: the Explore tree gains an opt-in/opt-out mode. The three-section layout and the instance node's focus selectors are now conditional on the opt-in flag; an opt-in/opt-out affordance node is rendered at the root.
- `resource-browser`: the Resources and Resource Details views are now hidden until the user opts in, via a `when`-clause context key restored from persisted global state on activation.

## Impact

- **package.json**: `when` clauses on the `localstack.resources` and `localstack.resourceDetails` view contributions; two new `commands` entries (hidden from the command palette via a `commandPalette` `when: false`).
- **`src/plugins/resource-browser.ts`**: read/persist the flag in `globalState`, `setContext` on activation, register the enable/disable commands, pass an enabled-state getter into the Explore provider, and refresh it on toggle.
- **`src/views/explore/viewProvider.ts`**: branch the root children and the instance children on the enabled state; append the opt-in/opt-out node.
- **`src/views/explore/treeItems.ts`**: two new tree-item classes for the opt-in and opt-out affordances, each carrying a command.
- **Tests**: provider tests asserting the opted-out root shows only LocalStack Instances + the opt-in node, the instance node omits the focus selectors when opted out, and the opted-in tree is unchanged from today.
- **No new dependencies.**
