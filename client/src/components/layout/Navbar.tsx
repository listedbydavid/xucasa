import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, Search, User, LogOut, Briefcase, Layers, TrendingUp, Users, Shield, Menu, X, FileText, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = isAuthenticated && (user as any)?.isAdmin;
  const isAgent = isAuthenticated && ((user as any)?.isAgent || (user as any)?.role === "agent");

  const navLink = (href: string, icon: any, label: string, testId?: string) => {
    const Icon = icon;
    const active = location === href;
    return (
      <Link
        key={href}
        href={href}
        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-2 ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        data-testid={testId}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        {label}
      </Link>
    );
  };

  const links = [
    { href: "/search", icon: Search, label: "Search" },
    { href: "/sell", icon: TrendingUp, label: "Sell" },
    { href: "/home-report", icon: FileText, label: "Home Report", testId: "link-home-report" },
    { href: "/buyers", icon: Users, label: "Buy" },
    ...(isAuthenticated ? [{ href: "/swipe", icon: Layers, label: "My Feed" }] : []),
    ...(!isAuthenticated ? [{ href: "/agent", icon: Briefcase, label: "For Agents" }] : []),
    ...(isAgent ? [{ href: "/agent", icon: Briefcase, label: "Agent Dashboard", testId: "link-agent-dashboard" }] : []),
    ...(isAuthenticated ? [{ href: "/dashboard", icon: User, label: "My Account", testId: "link-my-account" }] : []),
    ...(isAdmin ? [{ href: "/admin", icon: Shield, label: "Admin", testId: "link-admin-nav" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="banner">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <button
            className="standalone-back-btn items-center justify-center p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
            onClick={() => { if (window.history.length > 1) { window.history.back(); } else { window.location.href = "/"; } }}
            aria-label="Go back"
            data-testid="button-standalone-back"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <Link href="/" className="flex items-center gap-2 group" aria-label="xucasa home">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              xucasa
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {links.map(l => navLink(l.href, l.icon, l.label, (l as any).testId))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={`${user?.firstName || "User"}'s profile photo`} className="w-8 h-8 rounded-full border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="hidden md:inline-block">{user?.firstName || user?.email}</span>
              </div>
              <button 
                onClick={() => logout()}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-destructive/10"
                aria-label="Sign out"
                data-testid="button-sign-out"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <a 
                href="/auth" 
                className="text-sm font-medium text-foreground hover:text-primary transition-colors px-2"
                data-testid="link-login"
              >
                Log in
              </a>
              <a 
                href="/auth" 
                className="px-5 py-2.5 text-sm font-semibold bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-full transition-all shadow-sm hover:shadow active:scale-95"
                data-testid="link-signup"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur px-4 py-3 space-y-1 animate-in slide-in-from-top-2" aria-label="Mobile navigation">
          {links.map(l => navLink(l.href, l.icon, l.label, (l as any).testId))}
        </nav>
      )}
    </header>
  );
}
