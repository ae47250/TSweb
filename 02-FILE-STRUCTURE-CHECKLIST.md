# Alpha Tree Service Web UI — File Structure Checklist

## Complete Directory Map (Deployment-Ready)

```
alpha-tree-service-web-ui/
│
├── .env.local                          [CONFIG] Environment variables (local dev)
├── .env.production                     [CONFIG] Environment variables (Vercel)
├── .gitignore                          [CONFIG] Git exclusions
├── package.json                        [CONFIG] Dependencies, scripts
├── next.config.mjs                     [CONFIG] Next.js configuration
├── README.md                           [DOCS] Project overview
│
├── public/                             [STATIC ASSETS]
│   ├── alpha-logo.png                  Logo image (referenced in template)
│   ├── favicon.ico                     Browser tab icon
│   └── robots.txt                      SEO (optional)
│
├── app/                                [NEXT.JS APP ROUTER]
│   │
│   ├── layout.js                       Root layout (nav, global styles)
│   ├── page.js                         Home page (intro screen, form input)
│   ├── error.js                        Error boundary (fallback UI)
│   ├── not-found.js                    404 page (optional)
│   │
│   ├── api/                            [API ROUTES]
│   │   │
│   │   ├── pdf/
│   │   │   └── route.js                POST /api/pdf (Puppeteer handler)
│   │   │                               - Receives HTML + JSON
│   │   │                               - Launches Chromium
│   │   │                               - Generates PDF buffer
│   │   │                               - Returns PDF or error
│   │   │
│   │   ├── validate/
│   │   │   └── route.js                POST /api/validate (JSON validation)
│   │   │                               - Receives JSON from OpenAI
│   │   │                               - Runs validation rules
│   │   │                               - Returns errors/warnings
│   │   │
│   │   ├── openai/
│   │   │   └── route.js                POST /api/openai (mesh-to-JSON)
│   │   │                               - Receives raw user text
│   │   │                               - Calls OpenAI API
│   │   │                               - Returns structured JSON
│   │   │
│   │   ├── history/
│   │   │   └── route.js                GET /api/history (past estimates)
│   │   │                               - Retrieves JSON from database
│   │   │                               - Returns array of past jobs
│   │   │
│   │   └── audit/
│   │       └── route.js                POST /api/audit (log entry)
│   │                                   - Logs PDF generation event
│   │                                   - Stores metadata to database
│   │
│   ├── components/                     [REACT COMPONENTS]
│   │   ├── InputForm.jsx               Form capture (customer, job, options)
│   │   ├── JsonReview.jsx              Text-only review screen
│   │   ├── HtmlPreview.jsx             Client-side HTML preview (iframe)
│   │   ├── PdfGenerator.jsx            PDF generation button + status
│   │   ├── ErrorAlert.jsx              Error display with retry logic
│   │   ├── LoadingSpinner.jsx          Loading state indicator
│   │   ├── SuccessModal.jsx            Success message + download link
│   │   └── HistoryList.jsx             Past estimates list (optional)
│   │
│   └── styles/                         [STYLING]
│       ├── globals.css                 Global styles (layout, typography)
│       ├── page.module.css             Page-specific styles
│       └── components.module.css       Component-specific styles
│
├── lib/                                [UTILITIES & HELPERS]
│   ├── openaiClient.js                 OpenAI API wrapper
│   ├── validateJson.js                 JSON validation rules engine
│   ├── pdfGenerator.js                 Puppeteer wrapper (if extracted)
│   ├── dbClient.js                     Database connection (audit log)
│   ├── errorHandler.js                 Centralized error handling
│   ├── rateLimiter.js                  Rate limiting logic
│   ├── metadataGenerator.js            Document ID + timestamp logic
│   ├── filenamingRules.js              Filename generation rules
│   └── logger.js                       Structured logging
│
├── data/                               [REFERENCE DATA]
│   ├── alphaJSON-schema.json           AlphaJSON v1.4 schema (reference)
│   ├── botInstructions-v4.1.md         Bot rules (reference)
│   └── validationRules.json            All validation rules in JSON form
│
├── templates/                          [APPROVED TEMPLATES]
│   ├── AlphaTemplEST.html              Approved estimate/quote template
│   ├── style_updated.css               Approved styling
│   ├── template-bindings.json          HTML ↔ JSON field mappings
│   └── template-examples/              (Optional) Example filled PDFs
│       ├── example-estimate-1.json     Example 1: Simple 2-option job
│       └── example-estimate-2.json     Example 2: Complex 4-option job
│
├── config/                             [CONFIGURATION]
│   ├── constants.js                    App-wide constants (timeouts, limits)
│   ├── openaiPrompt.txt                System prompt for OpenAI
│   ├── validationMessages.json         User-facing validation messages
│   └── environment.schema.json         .env variable schema (validation)
│
├── tests/                              [TESTING - Optional Phase 2]
│   ├── __tests__/
│   │   ├── openai.test.js              OpenAI parsing tests
│   │   ├── validation.test.js          JSON validation tests
│   │   ├── pdf.test.js                 PDF generation tests
│   │   └── integration.test.js         End-to-end flow tests
│   │
│   └── fixtures/                       Test data
│       ├── messy-input-samples.json    Real-world input examples
│       └── expected-output-samples.json Expected JSON outputs
│
└── docs/                               [DOCUMENTATION]
    ├── ARCHITECTURE.md                 This document + deployment guide
    ├── API-ROUTES.md                   API endpoint documentation
    ├── VALIDATION-RULES.md             All validation logic (human-readable)
    ├── DEPLOYMENT.md                   Vercel deployment steps
    ├── TROUBLESHOOTING.md              Common issues + solutions
    └── CHANGELOG.md                    Version history
```

---

## File Count & Purpose Summary

| Category | Files | Purpose |
|----------|-------|---------|
| **Config** | 5 | Environment, dependencies, Next.js setup |
| **Static Assets** | 3 | Logo, favicon, SEO |
| **App Routes** | 1 | Root layout & entry page |
| **API Routes** | 5 | OpenAI, validation, PDF, history, audit |
| **React Components** | 8 | UI forms, preview, error handling |
| **Styling** | 3 | Global, page, component CSS |
| **Utilities** | 9 | OpenAI client, validation, PDF, database, errors, rate limiting |
| **Reference Data** | 3 | Schemas, instructions, rules |
| **Approved Templates** | 4 | HTML, CSS, bindings, examples |
| **Configuration** | 4 | Constants, prompts, messages, env schema |
| **Tests** | 4 | Unit + integration tests |
| **Documentation** | 6 | Architecture, API, rules, deployment, troubleshooting, changelog |
| **TOTAL** | **58 Files** | Complete deployment-ready web UI |

---

## Installation Checklist (Before Codex Starts)

- [ ] Create Next.js project: `npx create-next-app@latest alpha-tree-service-web-ui --typescript`
- [ ] Install dependencies: `npm install @sparticuz/chromium puppeteer-core`
- [ ] Copy `AlphaJSON.json` to `/data/alphaJSON-schema.json`
- [ ] Copy `AlphaTemplEST.html` to `/templates/AlphaTemplEST.html`
- [ ] Copy `style_updated.css` to `/templates/style_updated.css`
- [ ] Create `.env.local` with placeholder values
- [ ] Create all directories listed above
- [ ] Set up database connection (if using audit logging)
- [ ] Configure OpenAI API key in environment

---

## Deployment Tree (Vercel)

```
GitHub Repo (alpha-tree-service-web-ui)
    ↓
Vercel Project (connected)
    ↓
Build Command: npm run build
Start Command: npm start
Environment: production (.env.production)
    ↓
Deployed at: https://alpha-tree-service.vercel.app
    ↓
Public Routes:
  - https://alpha-tree-service.vercel.app/           (home/form)
  - https://alpha-tree-service.vercel.app/api/pdf    (POST only)
  - https://alpha-tree-service.vercel.app/api/openai (POST only)
```

---

## Critical Notes for Codex

1. **Never commit .env.local to GitHub** — use .env.example as template
2. **AlphaTemplEST.html is approved** — do NOT modify unless explicitly asked
3. **style_updated.css is approved** — preserve all CSS classes and color vars
4. **All user input flows through OpenAI first** — no direct HTML insertion
5. **Validation must happen BEFORE HTML generation** — blocking errors stop the flow
6. **PDF generation uses Puppeteer** — requires Node.js runtime (not edge)
7. **Database is optional Phase 2** — Phase 1 can skip audit logging if needed
