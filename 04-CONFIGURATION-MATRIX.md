# Alpha Tree Service Web UI — Configuration Matrix (Final V2.0)

## Environment Variables (.env.local & .env.production)

```bash
# ============================================================================
# OPENAI API (Required for messy-to-JSON conversion)
# ============================================================================
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
OPENAI_API_TIMEOUT=30000
OPENAI_MAX_TOKENS=2000

# ============================================================================
# PDF GENERATION (Puppeteer + Chromium) - DUAL FORMAT
# ============================================================================
PDF_TIMEOUT_SECONDS=45
PDF_RETRY_DELAY_MS=5000
PDF_RETRY_COUNT=1
PDF_CHROMIUM_HEADLESS=true
PDF_PAGE_FORMAT=Letter
PDF_MARGIN_INCHES=0.45
PDF_GENERATE_MOBILE_VERSION=true
MOBILE_PDF_WIDTH_PX=480
MOBILE_PDF_SINGLE_COLUMN=true

# ============================================================================
# SIGNATURE & OPTION SELECTION (V2)
# ============================================================================
SIGNATURE_FONT_FAMILY=cursive
SIGNATURE_FONT_SIZE=24
SIGNATURE_MIN_LENGTH=2
SIGNATURE_MAX_LENGTH=50
OPTION_SELECTION_REQUIRED=true
LEGAL_DISCLAIMER_TEXT="By typing your name, you agree this constitutes your electronic signature and you authorize Alpha Tree Service to perform the selected work."

# ============================================================================
# FILE UPLOAD & STORAGE (Vercel Blob)
# ============================================================================
VERCEL_BLOB_ENABLED=true
BLOB_STORE_SIGNED_PDFS=true
BLOB_RETENTION_DAYS=90

# ============================================================================
# SMS DELIVERY (Pingram NotificationAPI) - V2 UPDATED
# ============================================================================
SMS_PROVIDER=pingram
PINGRAM_API_KEY=xxxxxxxxxxxxx
TREE_DUDE_PHONE=502-310-6952
SMS_ENABLED=true
SMS_MESSAGE_TEMPLATE_INITIAL="Your estimate for {address} is ready! Full: {full_link} Mobile: {mobile_link} Document ID: {doc_id}"
SMS_MESSAGE_TEMPLATE_SIGNED="Signed estimate from {customer_name} received. {address} - Option {option} ({price}). EST-{doc_id}"

# ============================================================================
# EMAIL DELIVERY (V2 NEW - Two Options)
# ============================================================================
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
TREE_DUDE_EMAIL=huagalli@hotmail.com
EMAIL_ENABLED=true
EMAIL_FROM=estimates@alpha-tree-service.com
EMAIL_SUBJECT_SIGNED="Signed Estimate - {customer_name} - {address}"

# ============================================================================
# RATE LIMITING & SECURITY
# ============================================================================
RATE_LIMIT_REQUESTS_PER_HOUR=10
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_KEY_PREFIX=alpha_pdf
RATE_LIMIT_ENABLED=true

# ============================================================================
# VERCEL DEPLOYMENT
# ============================================================================
VERCEL_URL=https://alpha-tree-service.vercel.app
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://alpha-tree-service.vercel.app

# ============================================================================
# LOGGING & MONITORING
# ============================================================================
LOG_LEVEL=info
LOG_PDF_GENERATION_TIMES=true
LOG_OPENAI_REQUESTS=false
LOG_SIGNATURE_DATA=false

# ============================================================================
# FEATURE FLAGS (V2 UPDATED)
# ============================================================================
FEATURE_CLIENT_PREVIEW=true
FEATURE_SMS_DELIVERY=true
FEATURE_EMAIL_DELIVERY=true
FEATURE_DUAL_PDF=true
FEATURE_INTERACTIVE_SIGNATURE=true
FEATURE_OPTION_SELECTION=true
FEATURE_ANALYTICS=true

# ============================================================================
# DEBUG (Development Only)
# ============================================================================
DEBUG=alpha:*
SKIP_PDF_GENERATION=false
MOCK_OPENAI_RESPONSES=false
MOCK_SMS_DELIVERY=false
MOCK_EMAIL_DELIVERY=false
```

## Dependencies (Updated for V2)

### Core
- `next` (latest)
- `react` (latest)
- `react-dom` (latest)

### PDF Generation
- `puppeteer-core` (latest)
- `@sparticuz/chromium` (latest)

### API Integration
- `openai` (^4.0.0)
- `@notificationapi/node` (latest) — **Pingram SMS**
- `@sendgrid/mail` (^7.0.0) — Email delivery

### Utilities
- `zod` (^3.22)
- `date-fns` (^2.30)

## Resources & Costs

**Vercel Blob:** FREE (100 GB/month)  
**Pingram SMS:** FREE (100 SMS/month) → $0.01/SMS after  
**SendGrid Email:** FREE (100 emails/day) → $29+/month after  
**OpenAI:** ~$0.50/month (100 estimates)  
**Total Phase 1:** ~$0.50-1.50/month  

## Tree Dude Testing Contact Info (V2 NEW)

```
Tree Dude (Contractor):
- Phone: 502-310-6952 (for SMS notifications)
- Email: huagalli@hotmail.com (for signed PDF delivery)
- SMS Service: Pingram NotificationAPI
- Email Service: SendGrid
```

## Deployment Checklist

- [ ] Pingram account created
- [ ] PINGRAM_API_KEY added to Vercel
- [ ] SendGrid account created (optional Phase 1, required Phase 1.5)
- [ ] SENDGRID_API_KEY added to Vercel
- [ ] Tree dude phone & email in .env
- [ ] Vercel Blob enabled
- [ ] Test SMS delivery to 502-310-6952
- [ ] Test email delivery to huagalli@hotmail.com
- [ ] Deploy to Vercel

