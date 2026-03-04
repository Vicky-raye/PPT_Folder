import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
          <p className="text-muted-foreground">页面渲染出错</p>
          <pre className="text-xs text-left max-w-xl overflow-auto p-3 bg-muted rounded">
            {this.state.error?.message}
          </pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>刷新</Button>
            <Button asChild><Link to="/">返回首页</Link></Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
