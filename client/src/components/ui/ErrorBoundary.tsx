import { Component, ErrorInfo, ReactNode } from 'react';
import { theme } from '../../styles/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          padding: theme.spacing.xl
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center',
            backgroundColor: theme.colors.backgroundAlt,
            padding: theme.spacing.xl,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`
          }}>
            <div style={{
              fontSize: '64px',
              marginBottom: theme.spacing.lg
            }}>
              ⚠️
            </div>
            
            <h2 style={{
              margin: 0,
              marginBottom: theme.spacing.md,
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.semibold,
              color: theme.colors.text
            }}>
              Canvas Error Detected
            </h2>
            
            <p style={{
              margin: 0,
              marginBottom: theme.spacing.lg,
              fontSize: theme.fontSize.base,
              color: theme.colors.textSecondary,
              lineHeight: '1.6'
            }}>
              The workflow canvas encountered an error and needs to be reset. 
              Your workflow data is safe and will be restored.
            </p>

            <div style={{
              display: 'flex',
              gap: theme.spacing.md,
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: theme.colors.focus,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  fontSize: theme.fontSize.base,
                  fontWeight: theme.fontWeight.medium,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.focus;
                }}
              >
                🔄 Reset Canvas
              </button>
              
              <button
                onClick={this.handleReload}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.sm,
                  fontSize: theme.fontSize.base,
                  fontWeight: theme.fontWeight.medium,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundAlt;
                  e.currentTarget.style.borderColor = theme.colors.borderHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                🔃 Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginTop: theme.spacing.lg,
                textAlign: 'left',
                backgroundColor: theme.colors.backgroundPanel,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                border: `1px solid ${theme.colors.border}`
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: theme.fontWeight.medium,
                  color: theme.colors.text,
                  marginBottom: theme.spacing.sm
                }}>
                  🐛 Debug Information
                </summary>
                <pre style={{
                  margin: 0,
                  fontSize: theme.fontSize.xs,
                  color: theme.colors.textSecondary,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;