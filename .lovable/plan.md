

## Change Cooldown Duration to 20 Seconds

### Summary
Update the cooldown duration constant from 30 seconds to 20 seconds in the AudioMonitor component.

### Change
**File:** `src/components/AudioMonitor.tsx`

**Line 31:** Change the `COOLDOWN_DURATION_MS` constant from `30000` to `20000`

```typescript
// Before
const COOLDOWN_DURATION_MS = 30000;

// After
const COOLDOWN_DURATION_MS = 20000;
```

This single-line change will reduce the cooldown period after a fire alarm is confirmed from 30 seconds to 20 seconds.

