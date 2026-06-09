# LAD App Advanced Search Architecture

## Goal

Replace the old assistant onboarding flow with a mobile-first advanced search layer that reuses important LAD Frontend 2 data without mirroring desktop screens. The mobile app consumes compact, ranked, action-oriented payloads for leads, campaigns, calls, workflows, conversations, and insights.

## Workflow

```text
User Search Input
-> Query Processor
-> Search Service
-> Ranking Engine
-> LAD Frontend 2 Data Aggregator
-> Mobile Response Formatter
-> LAD App UI
```

## Backend API

```text
POST /api/search
GET  /api/search/suggestions
GET  /api/search/trending
GET  /api/search/recent
POST /api/search/recent
GET  /api/search/filter
GET  /api/mobile/home-feed
```

`POST /api/search` request:

```json
{
  "query": "high intent clinic leads",
  "page": 1,
  "limit": 12,
  "cursor": null,
  "filters": {
    "categories": ["lead", "campaign"],
    "tags": ["high-intent", "follow-up"]
  },
  "capabilities": {
    "keyword": true,
    "semantic": true,
    "fuzzy": true,
    "aiRanking": true,
    "mobileFormatter": true
  }
}
```

Response:

```json
{
  "results": [
    {
      "id": "lead_123",
      "type": "lead",
      "title": "Asha Rao at Bright Dental",
      "subtitle": "Owner · Bangalore",
      "summary": "Recent inquiry, high fit, needs WhatsApp follow-up.",
      "tags": ["high-intent", "recent"],
      "score": 0.94,
      "rankingReason": "Semantic match and recent activity",
      "updatedAt": "2026-05-29T10:00:00.000Z"
    }
  ],
  "meta": {
    "query": "high intent clinic leads",
    "correctedQuery": null,
    "intent": "find_leads",
    "total": 48,
    "page": 1,
    "limit": 12,
    "nextCursor": "cursor_2",
    "hasMore": true,
    "responseTimeMs": 86,
    "rankingModel": "hybrid-mobile-v1"
  },
  "related": ["clinic leads ready for follow up"],
  "filters": {
    "categories": [],
    "tags": []
  }
}
```

## Backend Services

Recommended Node/NestJS folders:

```text
src/search/
  search.controller.ts
  search.service.ts
  query-processor.service.ts
  ranking-engine.service.ts
  mobile-response-formatter.service.ts
  search-analytics.service.ts
  search-cache.service.ts
  lad-frontend2-adapter.service.ts
  dto/
  schemas/
```

Use Postgres for canonical relational records, Redis for hot query/cache/rate-limit data, and Meilisearch/Typesense/Elasticsearch for keyword, fuzzy, facets, and pagination. Add pgvector, Pinecone, Qdrant, or the search engine vector feature for semantic search.

## Schema Suggestions

```sql
create table search_documents (
  id text primary key,
  tenant_id text not null,
  source_type text not null,
  source_id text not null,
  title text not null,
  summary text,
  tags text[] default '{}',
  mobile_payload jsonb not null,
  searchable_text text not null,
  embedding vector,
  updated_at timestamptz not null default now()
);

create table search_events (
  id bigserial primary key,
  tenant_id text not null,
  user_id text not null,
  query text not null,
  intent text,
  filters jsonb,
  result_count int not null default 0,
  latency_ms int,
  clicked_document_id text,
  created_at timestamptz not null default now()
);

create table recent_searches (
  id bigserial primary key,
  tenant_id text not null,
  user_id text not null,
  query text not null,
  filters jsonb,
  created_at timestamptz not null default now()
);
```

Indexes:

- `search_documents(tenant_id, source_type, updated_at desc)`
- GIN on `tags` and `mobile_payload`
- Full-text index on `searchable_text`
- Vector index on `embedding`
- `search_events(tenant_id, user_id, created_at desc)`

## LAD Frontend 2 Extraction

The backend adapter should inspect and reuse existing LAD Frontend 2 API modules for leads, deals pipeline, campaigns, call logs, conversations, voice agents, and analytics. Desktop-only fields such as wide table state, column preferences, admin-only configuration, dense chart series, and builder canvas metadata should be excluded from mobile responses.

Transform rules:

- Lead cards: name, company, role, location, status, last activity, next action, score.
- Campaign cards: name, channels, status, next scheduled step, core performance numbers.
- Call cards: contact, outcome, recording availability, summary, follow-up action.
- Workflow cards: workflow name, active channels, current step, next recommended action.
- Insights: one short title, one sentence summary, metric delta, action link.

## AI Search Strategy

Query processor:

- Normalize text, detect language, trim noise, extract filters.
- Detect intent: `find_leads`, `open_workflow`, `review_activity`, `learn`, `unknown`.
- Correct spelling and expand synonyms.
- Generate autocomplete candidates and related queries.

Ranking engine:

- Combine keyword score, fuzzy score, vector similarity, recency, ownership, permissions, activity strength, and personalization.
- Re-rank the top 50 with an AI ranker only when needed.
- Return explainable `rankingReason` text for mobile trust.

Embeddings:

- Embed normalized title, summary, tags, stage, recent activity, and workflow actions.
- Re-embed on meaningful record changes.
- Store tenant-scoped vectors and enforce auth filters before ranking.

## Performance And Safety

- Debounce mobile requests around 250-300ms.
- Cache suggestions/trending/search pages in Redis with tenant, user, query, and filter keys.
- Use cursor pagination for infinite scroll.
- Keep mobile payloads under 12 results and omit desktop-only fields.
- Rate limit per user and tenant.
- Log query, intent, latency, zero-result count, clicked result, and selected filters.
- Apply auth and tenant filters before search fan-out and before AI ranking.
- Retry transient LAD Frontend 2 endpoint failures with bounded backoff.

## Mobile State Flow

```text
Search screen
-> useAdvancedSearch
-> useAdvancedSearchStore
-> advancedSearchService
-> /api/search endpoints
-> results, suggestions, recent, trending, filters
```

The current app implementation lives in:

```text
app/(tabs)/ai-assistant/index.tsx
src/services/advancedSearchService.ts
src/store/advancedSearchStore.ts
src/hooks/useAdvancedSearch.ts
```

The route name is kept for navigation compatibility, but the UI and data flow are Advanced Search.
