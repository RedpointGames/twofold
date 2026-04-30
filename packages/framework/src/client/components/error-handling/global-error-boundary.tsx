import { Component, type ReactNode } from "react";
import ErrorPage from "./error-page";

/**
 * This error boundary wraps the React stack for both SSR and browser scenarios, and is the last moment an error can be caught. This will be used when errors occur during SSR (where there's no dynamic router) or when errors occur in the router itself.
 */
export class GlobalErrorBoundary extends Component<
  { children?: ReactNode },
  {
    hasError: boolean;
    error: unknown;
  }
> {
  constructor(props: object) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error,
      hasError: true,
    };
  }

  render() {
    if (this.state.hasError) {
      return <CrashPage error={this.state.error} />;
    }

    return this.props.children;
  }
}

function CrashPage({ error }: { error: unknown }) {
  return <ErrorPage error={error} />;
}
