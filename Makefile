.PHONY: publish-ovsx publish-marketplace lint test

# VERSION can be set via environment variable or defaults to the version in package.json
VERSION ?= $(shell node -p "require('./package.json').version")

lint:
	@echo "Running format check..."
	npx biome ci .
	@echo "Running linter..."
	npx eslint

test:
	@echo "Running type check..."
	npx tsc
	@echo "Compiling extension..."
	npx vsce package
	@echo "Running tests..."
	npx vscode-test

publish-marketplace:
	@echo "Publishing VS Code extension to VS Marketplace..."
	@echo "Verifying PAT..."
	npx vsce verify-pat localstack -p $(VSCE_PAT)
	npx vsce publish $(VERSION) -p $(VSCE_PAT) --no-update-package-json

publish-ovsx:
	@echo "Publishing VS Code extension to Open VSX..."
	@echo "Verifying PAT..."
	npx ovsx verify-pat localstack -p $(OVSX_PAT)
	npx ovsx publish --packageVersion $(VERSION) -p $(OVSX_PAT)

