import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, Search, User, LogOut, Briefcase } from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              doocasa
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/search" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors flex items-center gap-2">
              <Search className="w-4 h-4" />
              Buy
            </Link>
            <Link href="/agent" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              For Agents
            </Link>
            <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors flex items-center gap-2">
              <User className="w-4 h-4" />
              For Clients
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
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
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
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
    </header>
  );
}
