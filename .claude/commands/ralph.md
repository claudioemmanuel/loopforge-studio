---
name: ralph
description: Start Ralph Loop for autonomous task implementation
arguments:
  - name: project
    description: "Project to work on: ios, backend, or web"
    required: false
  - name: change_id
    description: "Change ID from tasks.md (e.g., fix-profile-editing)"
    required: false
  - name: options
    description: "Additional options: --dry-run, --max-iterations N"
    required: false
---

# Ralph Wiggum AI Loop

Autonomous task implementation loop for the vamo-app monorepo.

## Usage

```
/ralph                              # Interactive mode
/ralph ios                          # List changes for iOS
/ralph ios fix-profile-editing      # Start loop for specific change
/ralph backend add-auth --dry-run   # Dry run to preview prompt
```

## How It Works

1. Reads tasks from `<project>/tasks.md`
2. Finds the first unchecked task (`- [ ]`) under the change heading
3. Implements that single task
4. Runs verification (`quick_verify`)
5. Marks task complete and commits
6. Repeats until all tasks done or stuck

## Completion Signals

- `RALPH_COMPLETE` - All tasks done, verification passed
- `RALPH_STUCK: <reason>` - Cannot proceed, needs human help

## Instructions

{{#if project}}
{{#if change_id}}

<!-- Start the loop -->

Run the Ralph loop for the specified project and change:

```bash
./ralph.sh {{project}} {{change_id}} {{options}}
```

Monitor progress in `.ralph/status.md`. If the loop gets stuck, it will pause and notify you.
{{else}}

<!-- List changes for project -->

List available changes for {{project}}:

```bash
./ralph.sh --list {{project}}
```

Then start with: `/ralph {{project}} <change-id>`
{{/if}}
{{else}}

<!-- Interactive mode - show help -->

Show available projects and usage:

```bash
./ralph.sh --help
```

**Quick start:**

1. Pick a project: `ios`, `backend`, or `web`
2. List changes: `./ralph.sh --list <project>`
3. Start loop: `/ralph <project> <change-id>`

**Commands:**

- `/ralph --status` - Check current session status
- `/ralph --cancel` - Cancel active session
  {{/if}}

## Project Configuration

| Project | Working Dir   | Quick Verify  | Full Verify              |
| ------- | ------------- | ------------- | ------------------------ |
| ios     | vamo-ios/     | swiftlint     | xcodebuild               |
| backend | vamo-backend/ | bun typecheck | typecheck + lint + test  |
| web     | vamo-web/     | bun typecheck | typecheck + lint + build |

## Example Workflow

```bash
# 1. Create tasks in project tasks.md
echo "## fix-profile-editing
- [ ] Add validation to profile form
- [ ] Fix avatar upload error handling
- [ ] Update profile API response type" >> vamo-ios/tasks.md

# 2. Start Ralph
/ralph ios fix-profile-editing

# 3. Ralph implements each task, commits, and continues
# 4. When done, outputs RALPH_COMPLETE
```
