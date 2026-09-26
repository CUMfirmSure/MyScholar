import { Component, type ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { Shell } from "./components/Shell";

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "Something went wrong." };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="grid h-full place-items-center bg-[#06070b] px-8 text-center text-white">
          <div>
            <p className="text-lg font-semibold">ScholarFlow hit a snag</p>
            <p className="mt-2 text-sm text-white/50">{this.state.message}</p>
            <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <Shell />
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
