import { Heart, BookmarkPlus, Home, X } from "lucide-react";

interface AuthPromptModalProps {
  feature: "favorite" | "save-search" | "my-home";
  onClose: () => void;
}

const COPY = {
  favorite: {
    icon: Heart,
    title: "Save homes you love",
    body: "Sign in to favorite this property and access your saved homes from any device.",
    cta: "Sign in to save",
  },
  "save-search": {
    icon: BookmarkPlus,
    title: "Save this search",
    body: "Sign in to save your search filters and get notified when new matching listings appear.",
    cta: "Sign in to save search",
  },
  "my-home": {
    icon: Home,
    title: "Track your home",
    body: "Sign in to add your home and get zoning intelligence, flood data, and neighborhood insights.",
    cta: "Sign in to track your home",
  },
};

export function AuthPromptModal({ feature, onClose }: AuthPromptModalProps) {
  const { icon: Icon, title, body, cta } = COPY[feature];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
          data-testid="button-auth-prompt-close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Icon className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-xl font-display font-bold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-7 leading-relaxed">{body}</p>

        <a
          href="/api/login"
          className="block w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors mb-3"
          data-testid="button-auth-prompt-login"
        >
          {cta}
        </a>
        <button
          onClick={onClose}
          className="block w-full text-muted-foreground text-sm font-medium hover:text-foreground transition-colors py-2"
          data-testid="button-auth-prompt-dismiss"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
