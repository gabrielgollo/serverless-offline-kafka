# Contributing

## Prerequisites

- Node.js `>= 18`
- Docker (for integration tests)

## Setup

```bash
npm ci
```

## Development workflow

1. Create a branch from `main`
2. Implement changes with tests
3. Run checks locally:

```bash
npm run lint
npm run test:unit
```

4. If your change affects Kafka runtime behavior, run integration test:

```bash
docker compose -f docker-compose-tests.yml up -d
npm run test:integration
docker compose -f docker-compose-tests.yml down
```

## Pull request checklist

- [ ] Feature/bug behavior is covered by tests
- [ ] `README.md` updated if config or runtime behavior changed
- [ ] No breaking change without migration guidance
- [ ] CI passes

## Commit style

Prefer focused commits with clear intent, for example:

- `feat: add batching timeout flush`
- `fix: validate kafka event brokers`
- `docs: expand configuration reference`
