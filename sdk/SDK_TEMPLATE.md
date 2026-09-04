# LAD Feature SDK Standard Template - Complete Implementation Guide

## 📋 Overview

This document provides the complete implementation of the **LAD SDK Standard Template** for all feature repositories. The template has been successfully implemented for the **Campaigns** feature and is ready to be replicated for the remaining 6 features.

## 🎯 Template Structure

```
sdk/features/[feature-name]/
├── api.ts              # API functions with feature-prefixed paths
├── hooks.ts            # Re-exports all hooks
├── hooks/              # Domain-specific hooks (split by responsibility)
│   ├── useItems.ts
│   ├── useItem.ts
│   └── useItemStats.ts
├── types.ts            # TypeScript type definitions
├── index.ts            # Main export file
├── README.md           # Feature-specific documentation
└── __tests__/
    ├── setup.ts        # Mock apiClient configuration
    ├── api.test.ts     # API function tests
    └── hooks.test.ts   # React hook tests
```

## 🛠️ Implementation Checklist

### For Each Feature, Create:

- [ ] **api.ts** - API functions with feature-prefixed paths
- [ ] **hooks.ts** - React hooks with consistent patterns
- [ ] **types.ts** - TypeScript type definitions
- [ ] **index.ts** - Re-export all public APIs
- [ ] **__tests__/setup.ts** - Mock apiClient
- [ ] **__tests__/api.test.ts** - Test all API functions
- [ ] **__tests__/hooks.test.ts** - Test all hooks
- [ ] **README.md** - Documentation with examples

## 📝 File Templates

### 1. api.ts Template

```typescript
/**
 * [Feature Name] - API Functions
 * 
 * All API paths are feature-prefixed: /[feature]/*
 * Uses shared apiClient from @/sdk/shared/apiClient
 */

import { apiClient } from '@/sdk/shared/apiClient';
import type { [YourTypes] } from './types';

// Example API function
export async function getItems(params?: ListParams): Promise<Item[]> {
  const response = await apiClient.get<{ data: Item[] }>('/feature-path', { params });
  return response.data;
}

export async function getItem(id: string): Promise<Item> {
  const response = await apiClient.get<Item>(`/feature-path/${id}`);
  return response.data;
}

export async function createItem(data: CreateInput): Promise<Item> {
  const response = await apiClient.post<{ data: Item }>('/feature-path', data);
  return response.data;
}

export async function updateItem(id: string, data: UpdateInput): Promise<Item> {
  const response = await apiClient.put<{ data: Item }>(`/feature-path/${id}`, data);
  return response.data;
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/feature-path/${id}`);
}
```

### 2. hooks.ts Template (Main Re-export File)

```typescript
/**
 * [Feature Name] - React Hooks
 * 
 * Re-exports all hooks from domain-specific files
 */

export { useItems } from './hooks/useItems';
export { useItem } from './hooks/useItem';
export { useItemStats } from './hooks/useItemStats';
```

### 2a. hooks/useItems.ts Template

```typescript
/**
 * useItems Hook
 * 
 * Manages items list with filtering, creation, and deletion
 */

import { useState, useCallback } from 'react';
import * as api from './api';
import type { Item, CreateInput, UpdateInput } from './types';

export function useItems(initialParams?: ListParams) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (params?: ListParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getItems(params || initialParams);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  const create = useCallback(async (data: CreateInput) => {
    setLoading(true);
    setError(null);
    try {
      const newItem = await api.createItem(data);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create item'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete item'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    items,
    loading,
    error,
    load,
    create,
    remove,
  };
}

export function useItem(itemId: string) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getItem(itemId);
      setItem(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const update = useCallback(async (data: UpdateInput) => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateItem(itemId, data);
      setItem(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update item'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  return {
    item,
    loading,
    error,
    load,
    update,
  };
}
```

### 3. types.ts Template

```typescript
/**
 * [Feature Name] - TypeScript Type Definitions
 */

// Status types
export type ItemStatus = 'active' | 'inactive' | 'pending' | 'archived';

// Main entity
export interface Item {
  id: string;
  name: string;
  description?: string;
  status: ItemStatus;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Input types
export interface CreateInput {
  name: string;
  description?: string;
}

export interface UpdateInput {
  name?: string;
  description?: string;
  status?: ItemStatus;
}

export interface ListParams {
  status?: ItemStatus;
  limit?: number;
  offset?: number;
}
```

### 4. index.ts Template

```typescript
/**
 * [Feature Name] - Main Export
 * 
 * Single entry point for all feature SDK exports
 */

// Export all types
export type {
  ItemStatus,
  Item,
  CreateInput,
  UpdateInput,
  ListParams,
} from './types';

// Export all API functions
export {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
} from './api';

// Export all hooks
export {
  useItems,
  useItem,
} from './hooks';
```

### 5. __tests__/setup.ts Template

```typescript
/**
 * Test Setup - Mock API Client
 * 
 * This file is optional - mocks can be placed directly in test files.
 * Vitest hoists vi.mock() calls, so they work best at the top of test files.
 */

import { vi } from 'vitest';

// Mock the apiClient module
vi.mock('@/sdk/shared/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
```

**Note:** For Vitest, it's recommended to place `vi.mock()` calls directly in test files before other imports to ensure proper hoisting.

### 6. __tests__/api.test.ts Template

```typescript
/**
 * [Feature Name] SDK - API Tests
 * 
 * Tests all API functions to ensure:
 * - Correct feature-prefixed paths are used
 * - Correct HTTP methods are used
 * - Request payloads are properly structured
 * - Responses are properly unwrapped
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient BEFORE importing anything that uses it
vi.mock('@/sdk/shared/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/sdk/shared/apiClient';
import * as api from '../api';
import type { Item } from '../types';

// Mock data
const mockItem: Item = {
  id: 'item-1',
  name: 'Test Item',
  status: 'active',
  organization_id: 'org-1',
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('[Feature Name] SDK – API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('fetches items using feature-prefixed path', async () => {
      const mockItems = [mockItem];
      (apiClient.get as any).mockResolvedValueOnce({ data: mockItems });
      
      const result = await api.getItems();
      
      expect(apiClient.get).toHaveBeenCalledWith('/feature-path', { params: undefined });
      expect(result).toEqual(mockItems);
    });

    it('includes query parameters when fetching items', async () => {
      (apiClient.get as any).mockResolvedValueOnce({ data: [] });
      
      await api.getItems({ status: 'active' });
      
      expect(apiClient.get).toHaveBeenCalledWith('/feature-path', {
        params: { status: 'active' }
      });
    });

    it('fetches single item by ID', async () => {
      (apiClient.get as any).mockResolvedValueOnce({ data: mockItem });
      
      const result = await api.getItem('item-1');
      
      expect(apiClient.get).toHaveBeenCalledWith('/feature-path/item-1');
      expect(result).toEqual(mockItem);
    });

    it('creates item with correct payload', async () => {
      const newItem = { name: 'New Item', description: 'Test' };
      (apiClient.post as any).mockResolvedValueOnce({ data: mockItem });
      
      const result = await api.createItem(newItem);
      
      expect(apiClient.post).toHaveBeenCalledWith('/feature-path', newItem);
      expect(result).toEqual(mockItem);
    });

    it('updates item with partial data', async () => {
      const updates = { name: 'Updated Name' };
      (apiClient.put as any).mockResolvedValueOnce({ data: { ...mockItem, ...updates } });
      
      const result = await api.updateItem('item-1', updates);
      
      expect(apiClient.put).toHaveBeenCalledWith('/feature-path/item-1', updates);
      expect(result.name).toBe('Updated Name');
    });

    it('deletes item by ID', async () => {
      (apiClient.delete as any).mockResolvedValueOnce({});
      
      await api.deleteItem('item-1');
      
      expect(apiClient.delete).toHaveBeenCalledWith('/feature-path/item-1');
    });
  });
});
```

### 7. __tests__/hooks.test.ts Template

```typescript
/**
 * [Feature Name] SDK - Hooks Tests
 * 
 * Tests all React hooks to ensure:
 * - State management works correctly
 * - API functions are called with correct parameters
 * - Loading and error states are properly managed
 * - Actions update state appropriately
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock apiClient BEFORE importing anything that uses it
vi.mock('@/sdk/shared/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import * as hooks from '../hooks';
import * as api from '../api';
import type { Item } from '../types';

// Mock data
const mockItem: Item = {
  id: 'item-1',
  name: 'Test Item',
  status: 'active',
  organization_id: 'org-1',
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('[Feature Name] SDK – Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useItems', () => {
    it('initializes with empty state', () => {
      const { result } = renderHook(() => hooks.useItems());
      
      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('loads items via SDK API', async () => {
      const mockItems = [mockItem];
      vi.spyOn(api, 'getItems').mockResolvedValueOnce(mockItems);
      
      const { result } = renderHook(() => hooks.useItems());
      
      await act(async () => {
        await result.current.load();
      });
      
      await waitFor(() => {
        expect(result.current.items.length).toBe(1);
        expect(api.getItems).toHaveBeenCalled();
      });
    });

    it('creates a new item', async () => {
      vi.spyOn(api, 'createItem').mockResolvedValueOnce(mockItem);
      
      const { result } = renderHook(() => hooks.useItems());
      
      await act(async () => {
        await result.current.create({ name: 'New Item' });
      });
      
      await waitFor(() => {
        expect(result.current.items.length).toBe(1);
        expect(api.createItem).toHaveBeenCalledWith({ name: 'New Item' });
      });
    });

    it('removes an item', async () => {
      vi.spyOn(api, 'getItems').mockResolvedValueOnce([mockItem]);
      vi.spyOn(api, 'deleteItem').mockResolvedValueOnce();
      
      const { result } = renderHook(() => hooks.useItems());
      
      await act(async () => {
        await result.current.load();
      });
      
      await act(async () => {
        await result.current.remove('item-1');
      });
      
      await waitFor(() => {
        expect(result.current.items.length).toBe(0);
        expect(api.deleteItem).toHaveBeenCalledWith('item-1');
      });
    });

    it('handles load errors', async () => {
      const error = new Error('Failed to load');
      vi.spyOn(api, 'getItems').mockRejectedValueOnce(error);
      
      const { result } = renderHook(() => hooks.useItems());
      
      await act(async () => {
        await result.current.load();
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('useItem', () => {
    it('initializes with null item', () => {
      const { result } = renderHook(() => hooks.useItem('item-1'));
      
      expect(result.current.item).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('loads single item', async () => {
      vi.spyOn(api, 'getItem').mockResolvedValueOnce(mockItem);
      
      const { result } = renderHook(() => hooks.useItem('item-1'));
      
      await act(async () => {
        await result.current.load();
      });
      
      await waitFor(() => {
        expect(result.current.item).toEqual(mockItem);
        expect(api.getItem).toHaveBeenCalledWith('item-1');
      });
    });

    it('updates item', async () => {
      const updated = { ...mockItem, name: 'Updated Name' };
      vi.spyOn(api, 'updateItem').mockResolvedValueOnce(updated);
      
      const { result } = renderHook(() => hooks.useItem('item-1'));
      
      await act(async () => {
        await result.current.update({ name: 'Updated Name' });
      });
      
      await waitFor(() => {
        expect(result.current.item?.name).toBe('Updated Name');
        expect(api.updateItem).toHaveBeenCalledWith('item-1', { name: 'Updated Name' });
      });
    });
  });
});
```

## 🎯 Standards & Best Practices

### API Path Convention

```typescript
// ✅ Correct - Feature-prefixed
apiClient.get('/campaigns')
apiClient.get('/apollo-leads/search')
apiClient.get('/deals-pipeline/stages')

// ❌ Wrong - Do not use /api/ prefix
apiClient.get('/api/campaigns')
```

### Response Unwrapping

```typescript
// API functions should unwrap the response
export async function getItem(id: string): Promise<Item> {
  const response = await apiClient.get<Item>(`/items/${id}`);
  return response.data;  // ✅ Unwrap here
}
```

### Hook Pattern

All hooks should return:
- `data` - The actual data
- `loading` - Boolean loading state
- `error` - Error object or null
- `load` - Function to load data
- `[actions]` - Other action functions (create, update, delete, etc.)

### Test Pattern

1. **Always clear mocks** in `beforeEach`
2. **Mock API responses** with proper data structure
3. **Use `waitFor`** for async operations
4. **Test error cases** along with success cases

## 📦 Shared Infrastructure

### apiClient.ts (Already Created)

Located at: `/Users/naveenreddy/Desktop/AI-Maya/LAD/frontend/sdk/shared/apiClient.ts`

Provides:
- ✅ GET, POST, PUT, DELETE, PATCH methods
- ✅ Authentication token handling
- ✅ Base URL configuration
- ✅ Query parameter support
- ✅ Error handling

## 🚀 Features to Implement

Apply this template to:

1. **apollo-leads** - Apollo leads management
2. **deals-pipeline** - Sales pipeline & CRM
3. **lead-enrichment** - Lead enrichment services
4. **social-integration** - Social media integration
5. **voice-agent** - Voice agent & calling
6. **advanced-search** - AI-powered mobile search

## 📊 Implementation Progress

| Feature | API | Hooks | Types | Tests | Status |
|---------|-----|-------|-------|-------|--------|
| campaigns | ✅ | ✅ | ✅ | ✅ | **Complete** |
| apollo-leads | ⏳ | ⏳ | ⏳ | ⏳ | Pending |
| deals-pipeline | ⏳ | ⏳ | ⏳ | ⏳ | Pending |
| lead-enrichment | ⏳ | ⏳ | ⏳ | ⏳ | Pending |
| social-integration | ⏳ | ⏳ | ⏳ | ⏳ | Pending |
| voice-agent | ⏳ | ⏳ | ⏳ | ⏳ | Pending |
| advanced-search | ⏳ | ⏳ | ⏳ | ⏳ | Pending |

## 🧪 Testing Guide

### Running Tests

```bash
# All tests
npm test

# Specific feature
npm run test:sdk:campaigns
npm run test:sdk:apollo-leads

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test File Naming

- `api.test.ts` - API function tests
- `hooks.test.ts` - React hook tests
- `setup.ts` - Mock setup (not a test file)

## 📖 Usage Examples

### Importing from SDK

```typescript
// Import hooks and types
import { useCampaigns, type Campaign } from '@/sdk/features/campaigns';
import { useApolloLeads, type Lead } from '@/sdk/features/apollo-leads';

// Import API functions directly
import { getCampaign } from '@/sdk/features/campaigns';
```

### Using in Components

```typescript
function FeaturePage() {
  const { items, loading, load, create } = useItems();

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

## ✅ Checklist for Each Feature

- [ ] Copy template files to feature directory
- [ ] Update feature name in all files
- [ ] Define API endpoints (feature-prefixed paths)
- [ ] Create type definitions
- [ ] Implement API functions
- [ ] Implement React hooks
- [ ] Write API tests
- [ ] Write hook tests
- [ ] Create README with usage examples
- [ ] Update package.json exports
- [ ] Run tests and verify all pass
- [ ] Update implementation progress table

## 🎉 Benefits of This Template

1. **Consistency** - All features follow same pattern
2. **Type Safety** - Full TypeScript support
3. **Testability** - Comprehensive test coverage
4. **Maintainability** - Clear separation of concerns
5. **Documentation** - Each feature has usage examples
6. **Scalability** - Easy to add new features

---

**Template Version:** 2.0  
**Last Updated:** January 2025  
**Status:** Production-ready
