import { useState } from "react";
import { Link } from "wouter";
import { BedDouble, Bath, Maximize, Heart, Sparkles } from "lucide-react";
import type { PropertyResponse } from "@shared/schema";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { useAuth } from "@/hooks/use-auth";
import { AuthPromptModal } from "@/components/AuthPromptModal";

interface PropertyCardProps {
  property: PropertyResponse;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending } = useToggleSavedProperty();
  const { isAuthenticated } = useAuth();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const isSaved = savedProps.some(sp => sp.propertyId === property.id);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    toggleSave({ propertyId: property.id, isSaved });
  };

  {/* generic house exterior placeholder */}
  const fallbackImage = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop";
  const imageUrl = property.imageUrl || fallbackImage;

  return (
    <>
      {showAuthPrompt && (
        <AuthPromptModal feature="favorite" onClose={() => setShowAuthPrompt(false)} />
      )}
    <Link href={`/property/${property.id}`} className="group block">
      <div className="bg-card rounded-2xl overflow-hidden hover-card-effect border border-border">
        {/* Image Area */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={imageUrl} 
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button 
              onClick={handleSave}
              disabled={isPending}
              className={`p-2.5 rounded-full backdrop-blur-md shadow-sm transition-all active:scale-95 ${
                isSaved 
                  ? "bg-white text-primary" 
                  : "bg-white/70 text-foreground hover:bg-white"
              }`}
            >
              <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {property.isOffMarket && (
              <span className="bg-foreground text-background text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                Make Me Move
              </span>
            )}
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${
              property.status === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {property.status === 'active' ? 'Active' : property.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5">
          <div className="flex items-end gap-2 mb-2">
            <h3 className="font-display font-bold text-2xl tracking-tight text-foreground">
              ${property.price.toLocaleString()}
            </h3>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium text-foreground mb-3">
            <span className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-muted-foreground" />
              {property.beds} <span className="text-muted-foreground font-normal">Beds</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-muted-foreground" />
              {property.baths} <span className="text-muted-foreground font-normal">Baths</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Maximize className="w-4 h-4 text-muted-foreground" />
              {property.sqft.toLocaleString()} <span className="text-muted-foreground font-normal">Sq Ft</span>
            </span>
          </div>

          <p className="text-muted-foreground text-sm font-medium truncate">
            {property.location}
          </p>
        </div>
      </div>
    </Link>
    </>
  );
}
