# LAD Feature Repository Rules

## 🎯 Objective

Create feature-specific repositories for LAD that allow **isolated development and testing** without breaking LAD architecture rules.

**IMPORTANT:** Feature repositories are NOT deployable applications. They are development workspaces for single features.

## 🧱 Repository Scope (Strict)

### ✅ Feature Repository MUST Contain

#### 1️⃣ Backend Feature (Required)
```
backend/features/<feature-name>/
├── controllers/
├── models/
├── middleware/
├── routes/
├── services/
├── manifest.js
└── README.md
```

**Rules:**
- ✅ Feature-based structure
- ✅ No imports outside feature boundary
- ✅ No file > 400 lines
- ✅ Uses LAD shared utilities only
- ✅ Feature-prefixed APIs only (`/api/<feature>/*`)

#### 2️⃣ Frontend SDK – Feature Only (Required)
```
frontend/sdk/features/<feature-name>/
├── api.ts              # API functions
├── hooks.ts            # Re-exports
├── hooks/              # Domain hooks
│   ├── useItems.ts
│   └── useItem.ts
├── types.ts            # TypeScript types
├── index.ts            # Main exports
└── __tests__/          # Tests
    ├── api.test.ts
    └── hooks.test.ts
```

**Rules:**
- ✅ No Next.js imports
- ✅ No JSX
- ✅ No CSS
- ✅ Hooks + API + types only
- ✅ Must be testable without web
- ✅ Feature-prefixed API paths

#### 3️⃣ Local Sandbox (Optional but Allowed)

If local UI testing is needed:

```
lad-sandbox/
├── backend/  → symlink to LAD/backend
├── sdk/      → symlink to LAD/frontend/sdk
└── web/      → symlink to LAD/frontend/web
```

**Rules:**
- ✅ Sandbox is LOCAL ONLY
- ✅ Sandbox is gitignored
- ✅ Sandbox is never committed
- ✅ Web code inside sandbox is disposable

**Setup:**
```bash
./setup-sandbox.sh
```

See [SANDBOX_SETUP.md](features/campaigns/SANDBOX_SETUP.md) for detailed instructions.

### ❌ Repository MUST NOT Contain

```
❌ Entire LAD backend
❌ Entire LAD frontend
❌ CI/CD configs
❌ Cloud Build files (cloudbuild.yaml)
❌ Infrastructure code
❌ Production .env files
❌ Committed frontend/web code
❌ Hardcoded secrets
❌ Database migrations (use LAD migrations)
```

## 🧪 Testing Requirements

### Backend Tests
- ✅ Unit or integration tests inside feature
- ✅ Mock external services
- ✅ Tests run independently
- ✅ No database dependencies

### SDK Tests
```
frontend/sdk/features/<feature>/__tests__/
├── api.test.ts     # Test all API functions
└── hooks.test.ts   # Test all hooks
```

**Requirements:**
- ✅ SDK tests must pass without backend running
- ✅ Use mocked apiClient
- ✅ Test state management
- ✅ Test error handling

**Run tests:**
```bash
cd frontend/sdk
npm test
npm run test:sdk:<feature-name>
```

## 🔁 Merge Rules (Non-Negotiable)

### ✅ Files That Get Merged to LAD

From feature repo, ONLY these folders are merged:

```bash
backend/features/<feature>/**
frontend/sdk/features/<feature>/**
```

### ❌ Files That Are NEVER Merged

```bash
lad-sandbox/**
frontend/web/**
.env*
cloudbuild.yaml
*.local.*
*-test.tsx (in web)
```

## 🔐 Golden LAD Rules

1. **Backend + SDK = Source of Truth**
   - Backend defines the API contract
   - SDK provides typed access to backend

2. **Web is Visualization Only**
   - Web code doesn't contain business logic
   - Web imports SDK, never calls backend directly

3. **No Vertical Forks**
   - Don't copy entire LAD stack
   - Work within feature boundaries

4. **No Client Forks**
   - One LAD codebase, multiple features
   - Features compose, they don't fork

5. **If a Change Breaks Isolation → Refactor, Don't Patch**
   - Don't hack around boundaries
   - Fix the architecture

6. **If Unsure → Ask Before Coding**
   - Architecture questions before implementation
   - Review feature design before building

## 📦 Deliverables from Feature Repo

When feature is complete, deliver:

### 1. Backend Feature Folder
```
backend/features/<feature>/
```

### 2. SDK Feature Folder
```
frontend/sdk/features/<feature>/
```

### 3. README.md
Must explain:
- ✅ Feature purpose and scope
- ✅ APIs exposed (endpoints, payloads)
- ✅ Dependencies (external services, LAD features)
- ✅ Migration steps (if database changes needed)
- ✅ Configuration requirements

### 4. Tests
- ✅ All backend tests passing
- ✅ All SDK tests passing
- ✅ Test coverage > 80%

## 🧾 Pre-Delivery Validation Checklist

Before merging to LAD, confirm:

- [ ] No file > 400 lines
- [ ] APIs are feature-prefixed (`/api/<feature>/*`)
- [ ] SDK has no framework coupling (no Next.js/React-specific code)
- [ ] Sandbox is not committed (check `.gitignore`)
- [ ] Web code is not included in feature repo
- [ ] All tests pass (`npm test`)
- [ ] Feature merges cleanly into LAD structure
- [ ] README documents all APIs and dependencies
- [ ] No hardcoded secrets or environment variables
- [ ] No database schema changes without migration plan
- [ ] Backend follows MVC pattern (controllers/models/middleware/routes)
- [ ] SDK hooks are split by domain (if > 300 lines)
- [ ] All types are properly exported

## 🚨 Validation Script

Run this before submitting:

```bash
#!/bin/bash
# validate-feature.sh

echo "Validating feature repository..."

# Check file sizes
echo "Checking file sizes..."
find . -name "*.js" -o -name "*.ts" | while read file; do
    lines=$(wc -l < "$file")
    if [ $lines -gt 400 ]; then
        echo "❌ File too large: $file ($lines lines)"
        exit 1
    fi
done

# Check for forbidden files
echo "Checking for forbidden files..."
if [ -d "lad-sandbox" ]; then
    echo "❌ Error: lad-sandbox/ should not be committed"
    exit 1
fi

if [ -d "frontend/web" ]; then
    echo "❌ Error: frontend/web/ should not be in feature repo"
    exit 1
fi

# Check tests
echo "Running tests..."
cd frontend/sdk
npm test
if [ $? -ne 0 ]; then
    echo "❌ SDK tests failed"
    exit 1
fi

echo "✅ Validation complete!"
```

## 📚 Directory Structure Template

Complete feature repository structure:

```
lad-feature-<name>/
├── backend/
│   └── features/
│       └── <feature-name>/
│           ├── controllers/
│           ├── models/
│           ├── middleware/
│           ├── routes/
│           ├── services/
│           ├── manifest.js
│           └── README.md
├── frontend/
│   └── sdk/
│       └── features/
│           └── <feature-name>/
│               ├── api.ts
│               ├── hooks.ts
│               ├── hooks/
│               ├── types.ts
│               ├── index.ts
│               ├── __tests__/
│               ├── README.md
│               ├── SANDBOX_SETUP.md
│               └── setup-sandbox.sh
├── .gitignore              # Must exclude lad-sandbox/
├── README.md               # Feature documentation
└── package.json            # If needed for SDK testing

# Local only (gitignored):
lad-sandbox/                # ← NEVER COMMIT
├── backend/  → symlink
├── sdk/      → symlink
└── web/      → symlink
```

## 🔄 Development Workflow

### 1. Initial Setup
```bash
# Clone feature repo
git clone <feature-repo-url>
cd lad-feature-<name>

# Setup sandbox for local testing
./frontend/sdk/features/<name>/setup-sandbox.sh
```

### 2. Development
```bash
# Develop backend feature
edit backend/features/<name>/

# Develop SDK
edit frontend/sdk/features/<name>/

# Test locally via sandbox
cd lad-sandbox/backend
npm start
```

### 3. Testing
```bash
# Run SDK tests
cd frontend/sdk
npm test

# Run backend tests
cd backend
npm test
```

### 4. Merge to LAD
```bash
# Copy to LAD (only feature folders)
cp -r backend/features/<name>/ /path/to/LAD/backend/features/
cp -r frontend/sdk/features/<name>/ /path/to/LAD/frontend/sdk/features/

# Commit in LAD repo
cd /path/to/LAD
git add backend/features/<name>/
git add frontend/sdk/features/<name>/
git commit -m "feat: add <name> feature"
```

## 🚨 IMPORTANT WARNING

**If your feature cannot be merged cleanly into LAD using these rules:**

1. ❌ **STOP** development
2. 🤔 **Redesign** the feature architecture
3. 💬 **Discuss** with team before proceeding
4. 🔄 **Refactor** to fit within boundaries

**DO NOT:**
- ❌ Commit workarounds
- ❌ Bypass isolation rules
- ❌ Create architectural debt
- ❌ Fork LAD structure

## 📖 Additional Resources

- [LAD Feature Developer Playbook](../../lad-docs/lad-feature-developer-playbook.md)
- [SDK Template](SDK_TEMPLATE.md)
- [Sandbox Setup Guide](features/campaigns/SANDBOX_SETUP.md)
- [Backend Feature Guidelines](../../backend/README.md)

## 🆘 Questions?

If you're unsure about:
- Feature boundaries
- API design
- Architecture decisions
- Merge process

**Ask before coding!** Prevention is easier than refactoring.

---

**Version:** 1.0  
**Last Updated:** 23 December 2025  
**Enforcement:** Mandatory for all feature repositories
