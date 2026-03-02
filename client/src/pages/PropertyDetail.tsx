import { useParams } from "wouter";
import { useProperty } from "@/hooks/use-properties";
import { useSavedProperties, useToggleSavedProperty } from "@/hooks/use-saved";
import { BedDouble, Bath, Maximize, MapPin, Heart, Sparkles, Building, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { MapView } from "@/components/MapView";
import { PublicRecordsPanel } from "@/components/PublicRecordsPanel";
import { ZoningPanel } from "@/components/ZoningPanel";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading } = useProperty(Number(id));
  const { data: savedProps = [] } = useSavedProperties();
  const { mutate: toggleSave, isPending: isSaving } = useToggleSavedProperty();
  const { isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-4xl font-display font-bold mb-4">Property not found</h1>
        <p className="text-muted-foreground">The property you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  const isSaved = savedProps.some(sp => sp.propertyId === property.id);

  const handleSave = () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    toggleSave({ propertyId: property.id, isSaved });
  };

  {/* generic interior home beautiful */}
  const fallbackImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop";
  const imageUrl = property.imageUrl || fallbackImage;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Image Section */}
      <div className="w-full h-[50vh] md:h-[60vh] relative group overflow-hidden bg-black">
        <img 
          src={imageUrl} 
          alt={property.title} 
          className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        
        <div className="absolute top-6 left-6 flex gap-3">
          <span className={`px-4 py-2 rounded-full font-bold text-sm shadow-xl backdrop-blur-md border border-white/20 ${
            property.status === 'active' ? 'bg-primary text-white' : 'bg-white/80 text-foreground'
          }`}>
            {property.status.toUpperCase()}
          </span>
          {property.isOffMarket && (
            <span className="bg-foreground text-background px-4 py-2 rounded-full font-bold text-sm shadow-xl backdrop-blur-md flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Make Me Move
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-card rounded-3xl p-6 sm:p-10 shadow-2xl border border-border">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-border pb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-3">
                ${property.price.toLocaleString()}
              </h1>
              <div className="flex items-center text-muted-foreground font-medium text-lg gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {property.title} • {property.location}
              </div>
            </div>
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg active:scale-95 ${
                isSaved 
                  ? "bg-primary text-white hover:bg-primary/90 hover:shadow-primary/30" 
                  : "bg-muted text-foreground hover:bg-muted/80 border border-border"
              }`}
            >
              <Heart className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
              {isSaved ? "Saved" : "Save Home"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <BedDouble className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.beds}</span>
              <span className="text-sm font-medium text-muted-foreground">Beds</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Bath className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.baths}</span>
              <span className="text-sm font-medium text-muted-foreground">Baths</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Maximize className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{property.sqft.toLocaleString()}</span>
              <span className="text-sm font-medium text-muted-foreground">Sq Ft</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-2xl border border-border">
              <Building className="w-8 h-8 text-primary mb-2" />
              <span className="text-xl font-bold mt-1">
                {property.hoaFee ? `$${property.hoaFee}` : 'None'}
              </span>
              <span className="text-sm font-medium text-muted-foreground">HOA/mo</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <h2 className="text-2xl font-display font-bold mb-4">About this home</h2>
              <div className="prose prose-lg text-muted-foreground max-w-none">
                {property.description.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-4 leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </div>

            <div>
              <div className="bg-muted p-6 rounded-3xl border border-border sticky top-24">
                <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Listing Agent
                </h3>
                {property.agent ? (
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-background rounded-full flex items-center justify-center border-2 border-primary overflow-hidden shadow-sm">
                      {property.agent.profileImageUrl ? (
                        <img src={property.agent.profileImageUrl} alt="Agent" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          {(property.agent.firstName?.[0] || 'A').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-lg">
                        {property.agent.firstName} {property.agent.lastName}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">Realtor</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground mb-6 font-medium">Agent details unavailable.</p>
                )}
                <button className="w-full bg-foreground text-background py-3.5 rounded-xl font-bold hover:bg-primary transition-colors shadow-md hover:shadow-xl active:scale-95">
                  Contact Agent
                </button>
              </div>

              <div className="mt-8 bg-muted rounded-3xl border border-border overflow-hidden h-64">
                <MapView properties={[property]} center={[-122.4194, 37.7749]} zoom={15} />
              </div>
            </div>
          </div>

          {/* Zoning & Development Intelligence */}
          <ZoningPanel propertyId={property.id} />

          {/* Public Records & Neighborhood Data */}
          <PublicRecordsPanel propertyId={property.id} />
        </div>
      </div>
    </div>
  );
}
