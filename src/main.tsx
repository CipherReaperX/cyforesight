import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
      // Cache lives for 24 hours in memory; persister writes to localStorage
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
})

// Persist non-sensitive query cache to localStorage so data survives page reloads
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'cyforesight-query-cache',
  // Keep at most 2 MB to avoid quota issues
  serialize: (data: unknown) => {
    try {
      const json = JSON.stringify(data)
      if (json.length > 2 * 1024 * 1024) return '{}'
      return json
    } catch {
      return '{}'
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        // Don't persist sensitive auth queries
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string
            return !['auth', 'user', 'me'].includes(key) && query.state.status === 'success'
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
