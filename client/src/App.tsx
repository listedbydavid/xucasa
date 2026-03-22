import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Mail } from "lucide-react";
import { initErrorTracker, reportError } from "@/lib/errorTracker";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    reportError(error, info.componentStack || undefined);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">We ran into an issue loading this page.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
            className="bg-primary text-white px-6 py-3 rounded-full font-bold"
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Navbar } from "@/components/layout/Navbar";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import PropertyDetail from "@/pages/PropertyDetail";
import Dashboard from "@/pages/Dashboard";
import AgentDashboard from "@/pages/AgentDashboard";
import Swipe from "@/pages/Swipe";
import Sell from "@/pages/Sell";
import Buyers from "@/pages/Buyers";
import Admin from "@/pages/Admin";
import HomeReport from "@/pages/HomeReport";
import AuthPage from "@/pages/AuthPage";
import ConversationThread from "@/pages/ConversationThread";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import { CookieConsent } from "@/components/CookieConsent";
import { InstallPrompt } from "@/components/InstallPrompt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/sell" component={Sell} />
      <Route path="/home-report" component={HomeReport} />
      <Route path="/swipe" component={Swipe} />
      <Route path="/property/:id" component={PropertyDetail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/conversations/:id" component={ConversationThread} />
      <Route path="/agent" component={AgentDashboard} />
      <Route path="/buyers" component={Buyers} />
      <Route path="/admin" component={Admin} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Footer() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && (user as any)?.isAdmin;
  const currentYear = new Date().getFullYear();

  const linkClass = "text-muted-foreground hover:text-foreground transition-colors";

  return (
    <footer className="border-t border-border/40 bg-muted/30 py-4 px-4 safe-bottom mt-auto" data-testid="footer">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5" data-testid="footer-logo">
              <img src="/icons/icon-192.png" alt="" className="w-5 h-5 rounded-sm" aria-hidden="true" />
              <span className="font-display font-bold text-sm tracking-tight text-foreground">xucasa</span>
            </Link>
            <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="footer-copyright">&copy; {currentYear} xucasa</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <Link href="/search" className={linkClass} data-testid="footer-link-search">Search</Link>
            <Link href="/sell" className={linkClass} data-testid="footer-link-sell">Sell</Link>
            <Link href="/home-report" className={linkClass} data-testid="footer-link-home-report">Home Report</Link>
            <Link href="/buyers" className={linkClass} data-testid="footer-link-buyers">Buyers</Link>
            <Link href="/agent" className={linkClass} data-testid="footer-link-agents">Agents</Link>
            <Link href="/terms" className={linkClass} data-testid="footer-link-terms">Terms</Link>
            <Link href="/privacy" className={linkClass} data-testid="footer-link-privacy">Privacy</Link>
            {isAdmin && (
              <Link href="/admin" className={linkClass} data-testid="link-admin">Admin</Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a href="mailto:david@xucasa.com" className={`flex items-center gap-1 ${linkClass}`} data-testid="footer-email">
              <Mail className="w-3 h-3" aria-hidden="true" />
              <span className="hidden md:inline">david@xucasa.com</span>
              <span className="md:hidden">Contact</span>
            </a>
            <span data-testid="footer-disclaimer">Equal Housing Opportunity</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground sm:hidden block text-center mt-2" data-testid="footer-copyright-mobile">&copy; {currentYear} xucasa</span>
      </div>
    </footer>
  );
}

function App() {
  useEffect(() => {
    initErrorTracker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background flex flex-col font-sans">
          <a href="#main-content" className="skip-to-main">
            Skip to main content
          </a>
          <Navbar />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </main>
          <Footer />
          <CookieConsent />
          <InstallPrompt />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
