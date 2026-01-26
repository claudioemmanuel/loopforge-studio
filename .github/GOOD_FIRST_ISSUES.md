# Good First Issues for New Contributors

Create these issues after the repository is public to welcome new contributors.

---

## Issue 1: Add Architecture Diagram to Documentation

**Title:** `[Docs] Add visual architecture diagram to README`

**Labels:** `good first issue`, `documentation`, `help wanted`

**Description:**
```markdown
## Summary
Add a visual architecture diagram to the README or a separate ARCHITECTURE.md file to help new developers understand how Loopforge Studio works.

## Details
The diagram should show:
- How the Next.js app connects to PostgreSQL and Redis
- The flow from task creation → brainstorming → planning → execution
- How the background worker processes tasks
- GitHub integration flow

## Acceptance Criteria
- [ ] Diagram is clear and easy to understand
- [ ] Uses a tool like Mermaid, Excalidraw, or similar (Mermaid preferred for easy editing)
- [ ] Embedded in README or linked ARCHITECTURE.md
- [ ] Brief text explanation accompanies the diagram

## Resources
- Current project structure is in README
- CLAUDE.md has detailed architecture notes
```

---

## Issue 2: Improve Error Messages for Common Setup Issues

**Title:** `[DX] Improve error messages for common setup failures`

**Labels:** `good first issue`, `enhancement`, `area: backend`

**Description:**
```markdown
## Summary
Make error messages more helpful when users encounter common setup problems.

## Current Problems
When setup fails, users often see generic errors like "Failed to connect" without guidance on how to fix it.

## Suggested Improvements
1. **Missing environment variables**: Show which specific variable is missing
2. **Database connection failed**: Suggest checking if Docker is running
3. **Redis connection failed**: Suggest checking Redis container status
4. **GitHub OAuth errors**: Link to setup guide section

## Files to Review
- `lib/db/index.ts` - Database connection
- `lib/queue/connection.ts` - Redis connection
- `lib/auth.ts` - Authentication setup

## Acceptance Criteria
- [ ] Error messages include actionable next steps
- [ ] Link to relevant documentation where helpful
- [ ] No sensitive information exposed in error messages
```

---

## Issue 3: Add Support for Additional AI Models

**Title:** `[Feature] Add more model options for each provider`

**Labels:** `good first issue`, `enhancement`, `area: ai`

**Description:**
```markdown
## Summary
Add support for additional AI models from each provider.

## Current Models
- **Anthropic**: claude-sonnet-4, claude-opus-4, claude-haiku-3
- **OpenAI**: gpt-4o, gpt-4-turbo, gpt-4o-mini
- **Google**: gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash

## Suggested Additions
- **Anthropic**: claude-3.5-sonnet (if available)
- **OpenAI**: gpt-4o-2024-11-20, o1-preview, o1-mini
- **Google**: gemini-1.5-pro, gemini-1.5-flash

## Files to Modify
- `lib/ai/client.ts` - Model definitions
- `components/settings/api-keys-section.tsx` - Model selector UI

## Acceptance Criteria
- [ ] New models added to available options
- [ ] Models work correctly with their respective providers
- [ ] Settings UI updated to show new options
```

---

## Issue 4: Add Keyboard Shortcuts for Common Actions

**Title:** `[Feature] Add keyboard shortcuts for power users`

**Labels:** `good first issue`, `enhancement`, `area: frontend`

**Description:**
```markdown
## Summary
Add keyboard shortcuts to improve productivity for power users.

## Suggested Shortcuts
- `n` - Open new task modal
- `Escape` - Close any open modal
- `?` - Show keyboard shortcuts help
- `1-7` - Jump to Kanban columns
- `/` - Focus search (if search exists)

## Implementation Notes
- Use a library like `react-hotkeys-hook` or implement custom handler
- Shortcuts should not interfere with text input fields
- Add a help modal showing all shortcuts

## Files to Review
- `components/kanban/kanban-board.tsx`
- `components/modals/new-task-modal.tsx`

## Acceptance Criteria
- [ ] Shortcuts work globally except in input fields
- [ ] Help modal (`?`) shows all available shortcuts
- [ ] Shortcuts documented in README or help section
```

---

## Issue 5: Add Dark Mode Toggle to Landing Page

**Title:** `[UI] Add theme toggle to landing page`

**Labels:** `good first issue`, `enhancement`, `area: frontend`

**Description:**
```markdown
## Summary
The dashboard has dark mode support, but the landing page (`app/page.tsx`) doesn't have a visible theme toggle.

## Current State
- Theme is detected from system preferences
- No manual toggle on landing page

## Suggested Solution
Add a simple sun/moon icon button in the top-right corner of the landing page that toggles between light and dark mode.

## Files to Modify
- `app/page.tsx` - Add toggle button
- Possibly create a shared `ThemeToggle` component

## Acceptance Criteria
- [ ] Toggle button visible on landing page
- [ ] Clicking toggles between light/dark mode
- [ ] Preference persists across page refreshes
- [ ] Smooth transition animation
```

---

## How to Create These Issues

After the repository is public, create each issue:

```bash
# Example using GitHub CLI
gh issue create \
  --title "[Docs] Add visual architecture diagram to README" \
  --body "$(cat issue-1-body.md)" \
  --label "good first issue" \
  --label "documentation" \
  --label "help wanted"
```

Or create them manually through the GitHub web interface.
