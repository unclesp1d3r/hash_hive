---
id: hashhive-httpexception-handling
trigger: "when adding or modifying Hono onError handler"
confidence: 0.95
domain: hono
source: local-repo-analysis
---

# Check HTTPException Before Generic Error Handling

## Action

Hono's `app.onError()` catches ALL errors including `HTTPException`. Always check for `HTTPException` first and return its response, otherwise auth 401s become 500s.

```typescript
import { HTTPException } from 'hono/http-exception';

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  // ... generic 500 handling
});
```

## Evidence

- Discovered when all 401 auth responses became 500s
- Auth middleware uses `throw new HTTPException(401, { res: ... })`
- The onError handler was catching it and returning a generic 500
- Fixed in packages/backend/src/index.ts
