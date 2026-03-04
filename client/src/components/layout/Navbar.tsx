import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, Search, User, LogOut, Briefcase, Layers, TrendingUp, Users, Shield, Menu, X } from "lucide-react";
import { useState } from "react";

const ADMIN_USER_ID = "55534280";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = isAuthenticated && user?.id === ADMIN_USER_ID;

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
      >
        <Icon className="w-4 h-4" />
        {label}
      </Link>
    );
  };

  const links = [
    { href: "/search", icon: Search, label: "Search" },
    { href: "/sell", icon: TrendingUp, label: "Sell" },
    { href: "/buyers", icon: Users, label: "Buy" },
    ...(isAuthenticated ? [{ href: "/swipe", icon: Layers, label: "My Feed" }] : []),
    ...(!isAuthenticated ? [{ href: "/agent", icon: Briefcase, label: "For Agents" }] : []),
    ...(isAuthenticated ? [{ href: "/dashboard", icon: User, label: "My Account", testId: "link-my-account" }] : []),
    ...(isAdmin ? [{ href: "/admin", icon: Shield, label: "Admin", testId: "link-admin-nav" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              xucasa
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => navLink(l.href, l.icon, l.label, (l as any).testId))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="hidden md:inline-block">{user?.firstName || user?.email}</span>
              </div>
              <button 
                onClick={() => logout()}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-destructive/10"
                title="Sign out"
                data-testid="button-sign-out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <a 
                href="/api/login" 
                className="text-sm font-medium text-foreground hover:text-primary transition-colors px-2"
              >
                Log in
              </a>
              <a 
                href="/api/login" 
                className="px-5 py-2.5 text-sm font-semibold bg-foreground text-background hover:bg-primary hover:text-primary-foreground rounded-full transition-all shadow-sm hover:shadow active:scale-95"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-white/95 backdrop-blur px-4 py-3 space-y-1 animate-in slide-in-from-top-2">
          {links.map(l => navLink(l.href, l.icon, l.label, (l as any).testId))}
        </div>
      )}
    </header>
  );
}
