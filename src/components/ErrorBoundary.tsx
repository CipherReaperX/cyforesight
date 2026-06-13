import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
            <p className="mt-1 text-sm text-slate-400">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
