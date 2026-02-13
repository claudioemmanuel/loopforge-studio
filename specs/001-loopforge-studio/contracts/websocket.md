# WebSocket Contract: Loopforge Studio

**Transport**: Socket.io over WebSocket
**Namespace**: `/board`
**Auth**: JWT in handshake `auth.token`

---

## Client → Server Events

### `board:subscribe`
Subscribe to real-time board updates.
```json
{ "userId": "<uuid>" }
```

### `board:unsubscribe`
Stop receiving board updates.
```json
{}
```

---

## Server → Client Events

### `task:updated`
Emitted when any task's stage, title, or metadata changes.
```json
{
  "taskId": "<uuid>",
  "stage": "EXECUTING",
  "title": "Add user authentication",
  "updatedAt": "2026-02-12T10:00:00Z"
}
```

### `task:created`
Emitted when a new task is created.
```json
{
  "task": { /* full Task object */ }
}
```

### `task:deleted`
Emitted when a task is deleted.
```json
{
  "taskId": "<uuid>"
}
```

### `task:stage_changed`
Emitted on every stage transition.
```json
{
  "taskId": "<uuid>",
  "fromStage": "READY",
  "toStage": "EXECUTING",
  "at": "2026-02-12T10:00:00Z"
}
```

---

## Notes

- All events are scoped to the authenticated user's tasks (no cross-user leakage).
- Log streaming uses SSE (see api.openapi.yaml `/tasks/{id}/logs/stream`),
  not WebSocket, to avoid bidirectional overhead for one-way log delivery.
- Board state rehydration on reconnect uses the REST `GET /tasks` endpoint.
