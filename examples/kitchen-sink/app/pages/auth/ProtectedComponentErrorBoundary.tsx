"use client";

import { Component, ReactNode } from "react";

export class ProtectedComponentErrorBoundary extends Component<
  { children?: ReactNode },
  { hasError: boolean; error: unknown }
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
      return (
        <p className="text-red-600">
          Error boundary caught failure to load component! You may have seen the
          component content briefly from the SSR render (but this did not result
          in the client being able to access the component source code).
        </p>
      );
    }

    return this.props.children;
  }
}
