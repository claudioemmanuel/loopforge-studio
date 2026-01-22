# Live Card Indicator Design

## Overview
Add a rotating gradient border effect to Kanban cards when a task is being executed by a worker, providing immediate visual feedback that the card is "live" without needing to open details.

## Visual Design

### Effect
- Animated gradient border that rotates continuously around the card edge
- Gradient colors: Green (#22c55e) → Teal (#14b8a6) → Cyan (#06b6d4) → back to Green
- Rotation speed: 3 seconds per full rotation (smooth, not frantic)
- Border width: 2px

### When Shown
- Only on cards with `status === "executing"`
- Works in both light and dark mode

### Cleanup
- Remove existing pulsing dot indicator (replaced by more prominent border effect)

## Implementation

### Technique
Pseudo-element approach with CSS conic-gradient:
1. Wrapper div with `position: relative` contains the rotating gradient
2. Gradient applied to a child element that's the full size of the wrapper
3. Card content sits on top, masking the center and leaving only the border visible
4. CSS `@keyframes` animates the gradient rotation

### Files to Modify

**1. `app/globals.css`**
Add keyframes animation:
```css
@keyframes gradient-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**2. `tailwind.config.ts`**
Extend animation:
```ts
animation: {
  'gradient-rotate': 'gradient-rotate 3s linear infinite',
}
```

**3. `components/kanban/kanban-card.tsx`**
- Conditionally wrap executing cards in gradient border container
- Remove existing pulsing dot indicator (lines 421-429)

### Code Structure

For executing cards:
```tsx
// Outer wrapper with padding for border width
<div className="relative p-[2px] rounded-xl">
  {/* Rotating gradient background */}
  <div className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,#22c55e,#14b8a6,#06b6d4,#22c55e)] animate-gradient-rotate" />

  {/* Actual card content */}
  <div className="relative bg-card rounded-xl ...">
    {/* existing card content */}
  </div>
</div>
```

For non-executing cards: render card directly without wrapper.

## Verification

- [ ] Executing cards show rotating gradient border
- [ ] Non-executing cards render normally without wrapper
- [ ] Animation is smooth (GPU-accelerated)
- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] Border radius matches card design
- [ ] No layout shift when card transitions to/from executing
