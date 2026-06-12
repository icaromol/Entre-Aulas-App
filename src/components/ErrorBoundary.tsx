import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-bold text-[#153b50]">Algo deu errado</p>
          <p className="text-sm text-gray-400">Recarregue a página para continuar.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-[#153b50] text-white text-sm font-medium hover:bg-[#153b50]/90 transition"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
