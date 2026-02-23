# LP Page Design Workflow (Editor-in-Chief Pattern)

Create or redesign an LP page using the editor-in-chief multi-agent workflow.
The user will provide the topic or content direction as $ARGUMENTS.

## Workflow Overview

You are the **editor-in-chief**. You design the overall layout first, then delegate specialized tasks to parallel agents, assemble the results, and polish.

## Step 1: Planning & Layout Design

1. Read the existing LP structure (`lp/css/style.css`, `lp/index.html`) to understand design conventions
2. Design the page layout:
   - Section order and hierarchy
   - Which sections need illustrations (SVG)
   - Which sections need screenshots (real app UI)
   - Bilingual structure (JP/EN)
3. Determine the HTML/CSS structure following existing LP patterns:
   - Vertical layout: **Title -> Illustration (large, centered) -> Text**
   - Max-width 520px for illustrations with subtle shadow
   - 80px section padding for generous spacing
   - Responsive breakpoints at 768px and 480px

## Step 2: Parallel Agent Delegation

Launch agents **in parallel** using the Task tool:

### Agent A: SVG Illustration Specialist
- Generate flat-design SVG illustrations
- Consistent style: viewBox="0 0 280 200", brand color #0abab5
- Font-family: Inter, sans-serif
- Save to `lp/images/`

### Agent B: Text & Translation Specialist
- Write Japanese content for all sections
- Translate to natural English
- Follow the tone: friendly, concise, user-focused

## Step 3: Assembly

1. Create the HTML page in `lp/<page-name>/index.html`
2. Use inline `<style>` for page-specific CSS
3. Follow the bilingual pattern:
   - `<div id="<page>-ja">` for Japanese content
   - `<div id="<page>-en">` for English content
   - Language switcher with `localStorage` persistence
4. Include header and footer matching other LP pages
5. Add navigation links in footer of all LP pages

## Step 4: Designer Review & Polish

Review the assembled page for:
- Visual balance and rhythm
- Illustration sizing (large, centered, with shadow)
- Section spacing consistency
- Typography hierarchy
- Responsive behavior
- Screenshot slots where real UI captures are needed

## Step 5: Screenshot List

Provide the user with a specific list of screenshots needed:
- Format: numbered list with exact UI state description
- Example: "Timer screen with 25:00 displayed and a label selected"

## Design System Reference

| Token              | Value                        |
|--------------------|------------------------------|
| Primary color      | `#0abab5`                    |
| Primary hover      | `#099d99`                    |
| Fonts              | Inter (UI), Noto Sans JP (日本語) |
| Border radius      | 12px (cards), 16px (large)   |
| Shadow             | `0 4px 24px rgba(0,0,0,0.07)` |
| Section padding    | 80px top/bottom              |
| Illustration max-w | 520px                        |
| Content max-w      | 900px                        |

## File Structure

```
lp/
├── css/style.css          # Shared styles
├── js/main.js             # Shared JS
├── js/i18n.js             # Translation keys
├── images/                # SVG illustrations
├── <page-name>/
│   └── index.html         # Page with inline styles
├── index.html             # Main LP
├── support/index.html
├── privacy/index.html
└── terms/index.html
```
