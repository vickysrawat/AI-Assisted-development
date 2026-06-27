<!-- TEMPLATE -->
# Architecture — Request Flows

> Load this file when tracing how a request moves through the Flask app,
> or when changing behaviour that spans multiple layers.

## Call Chains

[entry point → service → data access → database/external, per endpoint]

## Dependency Graph

[per-unit injected/imported dependencies]

## Highest Fan-In

| Type | Injected/Imported by |
|------|----------------------|

## Highest Fan-Out

| Unit | Dependency Count |
|------|------------------|
