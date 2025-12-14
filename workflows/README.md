# Browser Automation Workflows

This directory contains predefined browser automation workflows that can be executed from chat commands.

## Available Workflows

### 1. `bim-login-only.json`
**Description:** Login to BIM Gateway Service and take a screenshot

**Steps:**
1. Open BIM Gateway Service URL
2. Fill username
3. Click Next
4. Wait for password field
5. Fill password
6. Click Sign In
7. Take screenshot

**Usage in chat:**
```
Execute the bim-login-only workflow
Run bim-login-only
Login to BIM Gateway using bim-login-only
```

### 2. `bim-login-and-create.json`
**Description:** Complete workflow to login and create a new project

**Steps:**
1. Open BIM Gateway Service URL
2. Fill username
3. Click Next
4. Wait for password field
5. Fill password
6. Click Sign In
7. Take screenshot (after login)
8. Click home button
9. Fill project reference code
10. Fill project name
11. Click Next button (1st)
12. Click Next button (2nd)
13. Take final screenshot

**Usage in chat:**
```
Run the bim-login-and-create workflow
Execute bim-login-and-create to create a project
Create a BIM project using the workflow
```

## Creating Your Own Workflows

Create a JSON file in this directory with the following structure:

```json
{
  "name": "My Workflow Name",
  "description": "What this workflow does",
  "steps": [
    {
      "action": "open_page",
      "arguments": {
        "url": "https://example.com"
      },
      "description": "Navigate to website",
      "waitAfter": 2000
    },
    {
      "action": "fill",
      "arguments": {
        "selector": "#username",
        "text": "myuser"
      },
      "description": "Fill username",
      "waitAfter": 500
    },
    {
      "action": "click",
      "arguments": {
        "selector": "#login-button"
      },
      "description": "Click login",
      "waitAfter": 1000
    }
  ]
}
```

## Available Actions

| Action | Arguments | Description |
|--------|-----------|-------------|
| `open_page` | `url` | Navigate to a URL |
| `click` | `selector` | Click an element |
| `fill` | `selector`, `text` | Fill an input field |
| `wait_for_selector` | `selector`, `timeout` (optional) | Wait for element to appear |
| `screenshot` | none | Take a screenshot |

## Dynamic Values

Use `{timestamp}` in text fields to insert current timestamp:

```json
{
  "action": "fill",
  "arguments": {
    "selector": "#project-name",
    "text": "Project-{timestamp}"
  },
  "description": "Fill with unique name"
}
```

## Wait Times

- `waitAfter`: Milliseconds to wait after executing the step
- Useful for page transitions, animations, or API calls

## Testing

Use the test script to verify workflows:

```powershell
.\test-workflow-chat.ps1
```

Or test directly via chat API:

```powershell
Invoke-WebRequest -Uri "http://localhost:8085/api/chat" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"message":"Run the bim-login-only workflow"}'
```

## Tips

1. **Start simple** - Test individual steps before combining
2. **Add wait times** - Pages need time to load
3. **Use specific selectors** - IDs are more reliable than classes
4. **Test selectors first** - Open browser DevTools to verify selectors work
5. **Handle waits** - Use `wait_for_selector` for dynamic content
