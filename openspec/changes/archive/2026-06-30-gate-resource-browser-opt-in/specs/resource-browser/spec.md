## ADDED Requirements

### Requirement: Resources and Resource Details visibility is opt-in

The **Resources** and **Resource Details** views SHALL be hidden until the user opts in to the resource browser. Their contributions SHALL carry a `when` clause bound to the `localstack.resourceBrowserEnabled` context key, and the extension SHALL restore that context key from the persisted `globalState` flag on every activation so visibility survives window reloads. The views' providers MAY remain registered while hidden; gating is by visibility, not by conditional registration.

#### Scenario: Views hidden by default

- **WHEN** the extension activates and the resource browser has never been enabled (or was disabled)
- **THEN** the Resources and Resource Details views are not shown, and only the Explore view is present in the LocalStack activity-bar container

#### Scenario: Views restored after opting in and reloading

- **WHEN** the user has opted in and the window is reloaded
- **THEN** on activation the context key is re-asserted from the persisted flag and the Resources and Resource Details views are shown again

#### Scenario: Resource Details panel container hides when its view is gated

- **WHEN** the resource browser is disabled
- **THEN** the Resource Details panel view is hidden and its panel container does not present a stray empty tab
