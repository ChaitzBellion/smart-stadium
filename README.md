# Smart Stadiums & Tournament Operations — FIFA World Cup 2026

A GenAI-powered single-page web application to optimize stadium operations and enhance the FIFA World Cup 2026 experience through intelligent, real-time assistance.

## Architecture Overview

```mermaid
graph TD
    A[App Shell - index.html] --> B[Navigation Router]
    B --> C[Dashboard Module]
    B --> D[AI Assistant Module]
    B --> E[Match Center Module]
    B --> F[Crowd Analytics Module]
    B --> G[Venue Ops Module]
    B --> H[Fan Experience Module]
    
    I[Core Services Layer] --> J[Data Service]
    I --> K[AI Service - Simulated GenAI]
    I --> L[Event Bus - Pub/Sub]
    I --> M[State Manager]
    I --> N[Accessibility Service]
    
    C & D & E & F & G & H --> I
    
    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style I fill:#0f3460,stroke:#16213e,color:#fff
```

> [!IMPORTANT]
> This is a **frontend-only** application (HTML + CSS + JS). GenAI responses are **simulated** with a sophisticated rule-based engine to demonstrate the UX. No API keys or backend servers are required.

---

## Key Evaluation Parameters Addressed

| Parameter | How It's Addressed |
|---|---|
| **Code Quality** | ES Module architecture, JSDoc comments, consistent naming, separation of concerns across files |
| **Security** | CSP meta tags, input sanitization (DOMPurify-style), no `innerHTML` with user input, no `eval()`, XSS-safe rendering |
| **Efficiency** | Virtual scrolling for large lists, `requestAnimationFrame` for animations, debounced inputs, lazy module loading, efficient DOM updates |
| **Testing** | Each module exports testable functions, pure data transforms separated from DOM, a built-in test runner with assertions |
| **Accessibility** | WCAG 2.1 AA compliant — ARIA roles/labels, keyboard navigation, focus management, skip links, reduced-motion support, high-contrast mode, screen-reader announcements |
| **Problem Statement Alignment** | Every feature maps directly to FIFA World Cup 2026 stadium and tournament operations |

---

## Proposed Changes

### Project Structure

```
smart-stadium/
├── index.html              # App shell, SEO meta, CSP headers
├── css/
│   ├── design-system.css   # CSS custom properties, typography, color tokens
│   ├── layout.css          # Grid, responsive layouts, navigation
│   ├── components.css      # Cards, buttons, modals, charts, forms
│   └── accessibility.css   # Focus rings, reduced-motion, high-contrast
├── js/
│   ├── app.js              # App initialization, router, module loader
│   ├── services/
│   │   ├── data-service.js     # Match/venue/crowd data with realistic FIFA 2026 data
│   │   ├── ai-service.js       # Simulated GenAI engine with intent detection
│   │   ├── event-bus.js        # Pub/Sub for decoupled communication
│   │   ├── state-manager.js    # Centralized reactive state
│   │   └── security.js         # Input sanitization, CSP helpers
│   ├── modules/
│   │   ├── dashboard.js        # Real-time ops overview with KPI cards
│   │   ├── ai-assistant.js     # Chat interface with streaming-style responses
│   │   ├── match-center.js     # Match schedule, live scores, group standings
│   │   ├── crowd-analytics.js  # Heatmaps, density gauges, flow predictions
│   │   ├── venue-ops.js        # Facility status, maintenance, resource allocation
│   │   └── fan-experience.js   # Wayfinding, food ordering, accessibility info
│   ├── components/
│   │   ├── chart.js            # Canvas-based charting (no libraries)
│   │   ├── modal.js            # Accessible modal dialogs
│   │   └── toast.js            # Notification toasts with ARIA live regions
│   └── utils/
│       ├── dom.js              # Safe DOM manipulation helpers
│       ├── formatters.js       # Date, number, locale formatters
│       └── validators.js       # Input validation
├── tests/
│   └── test-runner.html        # Built-in test suite
└── assets/
    └── (generated images)
```

---

### Core Design System

#### [NEW] [design-system.css](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/css/design-system.css)
- FIFA-inspired color palette (deep navy `#1a0a2e`, magenta accent `#e94560`, teal `#00d2ff`, gold `#ffd700`)
- CSS custom properties for all design tokens (colors, spacing, typography, shadows, radii)
- Google Font: **Inter** for UI, **Outfit** for headings
- Fluid typography with `clamp()`
- Dark mode as default with optional light mode toggle

#### [NEW] [layout.css](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/css/layout.css)
- CSS Grid-based responsive dashboard layout
- Sidebar navigation with icon + text, collapsible on mobile
- Breakpoints: mobile (< 768px), tablet (768–1024px), desktop (> 1024px)

#### [NEW] [components.css](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/css/components.css)
- Glassmorphism cards with `backdrop-filter`
- Animated KPI counters
- Chat bubbles with typing indicator animation
- Heatmap visualization styles
- Progress bars and gauges
- Micro-animation keyframes (fade, slide, pulse, shimmer)

#### [NEW] [accessibility.css](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/css/accessibility.css)
- `:focus-visible` rings on all interactive elements
- `prefers-reduced-motion` media query to disable animations
- `prefers-contrast` support for high-contrast mode
- Skip-to-content link
- Screen reader only utility class (`.sr-only`)

---

### Core Services

#### [NEW] [data-service.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/services/data-service.js)
- Realistic FIFA World Cup 2026 match data (16 venues across US, Mexico, Canada)
- Live-updating crowd density simulation (using `setInterval` + randomized fluctuation)
- Venue facility status (gates, concessions, medical, security)
- Historical crowd flow patterns for prediction

#### [NEW] [ai-service.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/services/ai-service.js)
- Intent classification engine (keyword + pattern matching)
- Supported intents: wayfinding, food recommendations, match info, crowd alerts, accessibility help, emergency procedures, weather, transport
- Streaming-style response simulation (character-by-character with delay)
- Context-aware follow-up handling
- Response templates with dynamic data injection

#### [NEW] [event-bus.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/services/event-bus.js)
- Publish/Subscribe pattern for decoupled module communication
- Events: `crowd:update`, `match:update`, `alert:new`, `venue:status`, `ai:response`

#### [NEW] [state-manager.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/services/state-manager.js)
- Centralized immutable state store
- Reactive subscriptions (notify on change)
- State slices for each module

#### [NEW] [security.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/services/security.js)
- HTML entity encoding for user inputs
- URL sanitization
- Rate limiter for AI chat input
- Content Security Policy helpers

---

### Feature Modules

#### [NEW] [dashboard.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/dashboard.js)
**Real-time Operations Dashboard**
- KPI cards: Total attendance, active venues, security alerts, fan satisfaction score
- Live crowd density chart (canvas-based line chart)
- Venue status grid with color-coded health indicators
- Recent alerts feed with severity levels
- Quick-action buttons for emergency protocols

#### [NEW] [ai-assistant.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/ai-assistant.js)
**GenAI-Powered Chatbot**
- Chat interface with streaming responses
- Suggested quick-action chips (e.g., "Find nearest restroom", "Match schedule today", "Food near Gate 7")
- Multi-turn conversation with context memory
- Response cards with structured data (match cards, venue maps, food menus)
- Voice-input button (Web Speech API where supported)

#### [NEW] [match-center.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/match-center.js)
**Tournament Operations Hub**
- Match schedule with group/knockout phase filtering
- Live score cards with minute-by-minute updates (simulated)
- Group standings tables
- Venue assignment matrix
- Match-day countdown timers

#### [NEW] [crowd-analytics.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/crowd-analytics.js)
**Intelligent Crowd Management**
- Canvas-rendered crowd density heatmap
- Zone-by-zone capacity gauges
- Entry/exit flow rates
- Predictive crowd surge warnings
- Historical comparison overlays

#### [NEW] [venue-ops.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/venue-ops.js)
**Venue & Facility Management**
- 16 FIFA 2026 venues with real names and capacities
- Facility status dashboard (HVAC, lighting, security, medical)
- Maintenance request tracker
- Resource allocation optimizer
- Staff deployment overview

#### [NEW] [fan-experience.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/modules/fan-experience.js)
**Fan-Facing Services**
- Interactive wayfinding with landmark-based directions
- Food & beverage ordering with wait-time estimates
- Accessibility services finder (wheelchair, hearing loop, quiet zones)
- Transport links and parking status
- Multilingual support toggle (EN/ES/FR)

---

### Shared Components

#### [NEW] [chart.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/components/chart.js)
- Pure Canvas API charting — no external libraries
- Line, bar, doughnut, and gauge chart types
- Animated drawing with `requestAnimationFrame`
- Responsive resizing via `ResizeObserver`
- Accessible: provides `aria-label` and data table fallback

#### [NEW] [modal.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/components/modal.js)
- Focus trap, `Escape` to close, restore focus on dismiss
- ARIA `role="dialog"`, `aria-modal="true"`, `aria-labelledby`

#### [NEW] [toast.js](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/js/components/toast.js)
- `aria-live="polite"` region for screen readers
- Auto-dismiss with configurable duration
- Severity levels: info, success, warning, error

---

### Testing

#### [NEW] [test-runner.html](file:///C:/Users/HP/.gemini/antigravity/scratch/smart-stadium/tests/test-runner.html)
- Built-in browser test suite (no npm/dependencies)
- Tests for: data-service, ai-service (intent detection), security (sanitization), state-manager, formatters, validators
- Assertion helpers (`assertEqual`, `assertThrows`, `assertContains`)
- Visual test report with pass/fail counts

---

## User Review Required

> [!IMPORTANT]
> **No Backend / No Real AI API**: This app simulates GenAI responses with a sophisticated rule-based engine. The chat feels like AI but runs entirely client-side. If you want real API integration (e.g., Gemini API), please let me know and provide an API key.

> [!NOTE]
> **Data is Simulated**: Match scores, crowd density, and venue stats use realistic but simulated data that updates in real-time to demonstrate the operational monitoring capabilities.

## Open Questions

1. **Do you want real GenAI API integration** (e.g., Google Gemini) or is the simulated AI assistant sufficient for demonstration?
2. **Any specific FIFA 2026 venues** you'd like highlighted, or should I include all 16 official venues?
3. **Do you want a light/dark mode toggle**, or should the app be dark-mode only (dark mode is more premium for operations dashboards)?

---

## Verification Plan

### Automated Tests
- Open `tests/test-runner.html` in browser — all tests should pass (green)
- Tests cover: input sanitization, AI intent detection, data transformations, state management

### Manual Verification
- Open `index.html` in browser — full app loads with no console errors
- Navigate all 6 sections via sidebar
- Test AI chatbot with various queries
- Verify keyboard-only navigation (Tab through all interactive elements)
- Test with screen reader (Narrator on Windows)
- Resize browser to verify responsive design at all breakpoints
- Check `prefers-reduced-motion` with OS setting
