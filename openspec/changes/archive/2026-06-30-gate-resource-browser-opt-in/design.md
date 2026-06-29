# Design

## Decisions

### D1 — Visibility via a context key, not conditional registration

The Resources and Resource Details providers stay **registered unconditionally** in the `resource-browser` plugin. Visibility is controlled entirely by a `when` clause on the view contributions bound to the context key `localstack.resourceBrowserEnabled`. This avoids a register/dispose dance on every toggle and keeps the providers' lifecycle simple — a hidden view simply isn't asked for its children.

### D2 — `globalState` is the source of truth; the context key is derived

The opt-in choice is persisted in `context.globalState` under `localstack.resourceBrowserEnabled` (default `false`). VS Code context keys do **not** survive a window reload, so on every activation the plugin reads the stored value and calls `setContext` to re-assert it. The context key is therefore always derived from `globalState`, never the other way around.

Scope is **global** (per user, all workspaces), matching a "preview feature" toggle. The default is opted-out, so existing users land in the familiar minimal experience after upgrading.

### D3 — Opt-in/opt-out is a tree node, not `viewsWelcome`

`viewsWelcome` content only renders when a tree view returns **no** children. The opted-out Explore view still shows the LocalStack Instances section, so it is never empty — `viewsWelcome` cannot be used. The affordance is therefore a dedicated tree node appended at the **root** of the Explore tree: an opt-in node when disabled, an opt-out node when enabled. Each node carries a `command` (`localstack.enableResourceBrowser` / `localstack.disableResourceBrowser`) and is **not** a `FocusSelectorTreeItem`, so it never feeds the Resources view.

### D4 — The provider reads the flag through a getter

`LocalStackViewProvider` is constructed with an `isResourceBrowserEnabled: () => boolean` callback rather than a snapshot boolean, so a toggle followed by `refresh()` re-reads the live value. The two branch points:

- **Root children** — opted out: `[LocalStack Instances section, OptInNode]`; opted in: `[LocalStack Instances, Cloud Profiles, Workspace IaC, OptOutNode]`.
- **Instance children** — opted out (running): `[App Inspector]`; opted in (running): `[App Inspector, View: All Resources, ...saved instance views]`. A stopped instance still has no children in either mode.

### D5 — Toggle command flow

```
user clicks opt-in node
  → localstack.enableResourceBrowser
      → globalState.update(KEY, true)
      → setContext(KEY, true)            // reveals Resources + Resource Details
      → localStackProvider.refresh()     // re-renders Explore: 3 sections + opt-out node
```

`disable` is symmetric with `false`. The `setContext` and the provider `refresh` together make the change appear without a reload.

## Diagram

```
                globalState[localstack.resourceBrowserEnabled]
                                   │
              ┌────────────────────┴────────────────────┐
        on activation                              on toggle command
              │                                          │
        setContext(KEY, stored)                  update + setContext + refresh
              │                                          │
   ┌──────────┴───────────┐                  ┌───────────┴───────────┐
   ▼                      ▼                   ▼                       ▼
when-clause          Explore provider     reveals/hides          re-renders
gates Resources +    reads getter →        Resources +            Explore root +
Resource Details     branches children     Resource Details       instance children
```

## Risks / Open questions

- **Panel container auto-hide** — when `localstack.resourceDetails` is the only view in the `localstackPanel` container and is hidden, the container tab should disappear automatically. This is the documented VS Code behavior but should be confirmed at runtime; if a stray empty tab remains, gate the container too.
- **First-open sizing** — the existing `size` weights assume all three views are present. In opted-out mode only Explore is in the activity bar; sizing is a non-issue there. No change needed.
