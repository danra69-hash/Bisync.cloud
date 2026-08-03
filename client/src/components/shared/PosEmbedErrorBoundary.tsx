import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Shown above the retry control. */
  title?: string
}

type State = {
  error: Error | null
}

/** Keeps the host app alive when the embedded Bisync POS tree throws. */
export class PosEmbedErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('POS embed crashed', error, info.componentStack)
  }

  private retry = () => {
    this.setState({ error: null })
  }

  private hardReload = () => {
    try {
      // Drop stale register session that may reference removed demo table ids.
      localStorage.removeItem('bisync-pos-active-register-session')
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    const title = this.props.title || 'POS failed to load'
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          gap: 12,
          height: '100%',
          minHeight: '12rem',
          padding: 16,
          textAlign: 'center',
        }}
        role="alert"
      >
        <div>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{title}</p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75, maxWidth: 420 }}>
            {this.state.error.message || 'Unexpected error in POS.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.retry}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #d0d5dd',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry POS
          </button>
          <button
            type="button"
            onClick={this.hardReload}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #0ea5e9',
              background: '#0ea5e9',
              color: '#04111d',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload POS
          </button>
        </div>
      </div>
    )
  }
}
