import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import { Home as HomeIcon, Mail, MapPin } from "lucide-react";

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
    <footer className="border-t border-border/40 bg-muted/30 pt-12 pb-6 px-4 safe-bottom" data-testid="footer">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4" data-testid="footer-logo">
              <div className="bg-primary text-white p-1.5 rounded-md">
                <HomeIcon className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-foreground">
                xucasa
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Your trusted partner in finding the perfect home. Modern real estate, simplified.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="mailto:david@xucasa.com" className={`flex items-center gap-2 ${linkClass}`} data-testid="footer-email">
                <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                david@xucasa.com
              </a>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>San Diego, CA</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-foreground mb-4">Resources</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/search" className={linkClass} data-testid="footer-link-search">
                  Search Homes
                </Link>
              </li>
              <li>
                <Link href="/sell" className={linkClass} data-testid="footer-link-sell">
                  Sell Your Home
                </Link>
              </li>
              <li>
                <Link href="/home-report" className={linkClass} data-testid="footer-link-home-report">
                  Home Report
                </Link>
              </li>
              <li>
                <Link href="/buyers" className={linkClass} data-testid="footer-link-buyers">
                  Buyer Profiles
                </Link>
              </li>
              <li>
                <Link href="/swipe" className={linkClass} data-testid="footer-link-swipe">
                  Property Feed
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-foreground mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className={linkClass} data-testid="footer-link-about">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/agent" className={linkClass} data-testid="footer-link-agents">
                  For Agents
                </Link>
              </li>
              <li>
                <a href="mailto:david@xucasa.com" className={linkClass} data-testid="footer-link-contact">
                  Contact
                </a>
              </li>
              {isAdmin && (
                <li>
                  <Link href="/admin" className={linkClass} data-testid="link-admin">
                    Admin
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-foreground mb-4">Legal</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/terms" className={linkClass} data-testid="footer-link-terms">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass} data-testid="footer-link-privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms#fair-housing" className={linkClass} data-testid="footer-link-fair-housing">
                  Fair Housing
                </Link>
              </li>
              <li>
                <Link href="/terms#accessibility" className={linkClass} data-testid="footer-link-accessibility">
                  Accessibility
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span data-testid="footer-copyright">&copy; {currentYear} xucasa. All rights reserved.</span>
          <span data-testid="footer-disclaimer">Equal Housing Opportunity</span>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background flex flex-col font-sans">
          <a href="#main-content" className="skip-to-main">
            Skip to main content
          </a>
          <Navbar />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <Router />
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
