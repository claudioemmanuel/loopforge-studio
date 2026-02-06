# Container Validation Report

Date: 2026-02-06
Project mode: local-first
Validation target: both compose modes

## Commands

### Production compose

- `docker compose build`
- `docker compose up -d`
- `docker compose ps`
- `docker compose logs --tail=200`

### Dev compose

- `docker compose -f docker-compose.dev.yml build`
- `docker compose -f docker-compose.dev.yml up -d`
- `docker compose -f docker-compose.dev.yml ps`
- `docker compose -f docker-compose.dev.yml logs --tail=200`

## Results

Populate with actual command outputs in this session.
