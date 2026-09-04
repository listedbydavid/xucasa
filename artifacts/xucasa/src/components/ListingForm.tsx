import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { Loader2, ArrowLeft, Camera, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { PropertyResponse } from "@/shared/schema";
import { useUploadPropertyPhotos, useDeletePropertyPhoto, useReorderPropertyPhotos } from "@/hooks/use-properties";
import { useToast } from "@/hooks/use-toast";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
function buildStreetViewUrl(lat: number, lng: number, size = "800x500"): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=90&pitch=5&key=${MAPS_KEY}`;
}

export function ListingForm({
  property,
  onSubmit,
  isPending,
}: {
  property?: PropertyResponse;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const [, setLocation] = useLocation();
  const { isLoaded } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: property?.title || "",
    description: property?.description || "",
    price: property?.price?.toString() || "",
    addressStreetNumber: property?.addressStreetNumber || "",
    addressStreetName: property?.addressStreetName || "",
    addressUnitNumber: property?.addressUnitNumber || "",
    addressCity: property?.addressCity || "",
    addressState: property?.addressState || "",
    addressZip: property?.addressZip || "",
    location: property?.location || "",
    beds: property?.beds?.toString() || "",
    baths: property?.baths?.toString() || "",
    sqft: property?.sqft?.toString() || "",
    lotSize: property?.lotSize?.toString() || "",
    hoaFee: property?.hoaFee?.toString() || "",
    imageUrl: property?.imageUrl || "",
    isOffMarket: property?.isOffMarket || false,
    openHouseDate: (property as any)?.openHouseDate
      ? new Date((property as any).openHouseDate).toISOString().split("T")[0]
      : "",
    openHouseTime: (property as any)?.openHouseTime || "",
    listDate: (property as any)?.listDate
      ? new Date((property as any).listDate).toISOString().split("T")[0]
      : "",
    virtualTourUrl: (property as any)?.virtualTourUrl || "",
    propertyType: (property as any)?.propertyType || "SFH",
    status: property?.status || "draft",
    confidentialRemarks: property?.confidentialRemarks || "",
    showingInstructions: property?.showingInstructions || "",
    accessInstructions: property?.accessInstructions || "",
  });

  const [streetViewUrl, setStreetViewUrl] = useState<string | null>(null);
  const [streetViewUsed, setStreetViewUsed] = useState(false);

  useEffect(() => {
    if (isLoaded && inputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "geometry", "address_components"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place || !place.geometry?.location) return;

        let streetNumber = "";
        let route = "";
        let city = "";
        let state = "";
        let zip = "";

        place.address_components?.forEach(component => {
          const types = component.types;
          if (types.includes("street_number")) streetNumber = component.short_name;
          if (types.includes("route")) route = component.short_name;
          if (types.includes("locality")) city = component.long_name;
          if (types.includes("administrative_area_level_1")) state = component.short_name;
          if (types.includes("postal_code")) zip = component.short_name;
        });

        const location = place.formatted_address || `${streetNumber} ${route}, ${city}, ${state} ${zip}`.trim();

        setFormData(prev => ({
          ...prev,
          location,
          addressStreetNumber: streetNumber,
          addressStreetName: route,
          addressCity: city,
          addressState: state,
          addressZip: zip,
        }));

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        if (MAPS_KEY) {
          const svUrl = buildStreetViewUrl(lat, lng);
          setStreetViewUrl(svUrl);
          if (!prevFormDataRef.current.imageUrl) {
            setFormData(prev => ({ ...prev, imageUrl: svUrl }));
            setStreetViewUsed(true);
          }
        }
      });
    }
  }, [isLoaded]);

  const prevFormDataRef = useRef(formData);
  useEffect(() => {
    prevFormDataRef.current = formData;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      price: Number(formData.price) || 0,
      beds: Number(formData.beds) || 0,
      baths: formData.baths || "0",
      sqft: Number(formData.sqft) || 0,
      lotSize: formData.lotSize ? Number(formData.lotSize) : undefined,
      hoaFee: formData.hoaFee ? Number(formData.hoaFee) : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const uploadPhotosMutation = useUploadPropertyPhotos();
  const deletePhotoMutation = useDeletePropertyPhoto();
  const reorderPhotosMutation = useReorderPropertyPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!property) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length + (property.photos?.length || 0) > 20) {
      toast({ title: "Too many photos", description: "You can upload up to 20 photos.", variant: "destructive" });
      return;
    }
    const form = new FormData();
    files.forEach(f => form.append("photos", f));
    await uploadPhotosMutation.mutateAsync({ id: property.id, formData: form });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoDelete = async (url: string) => {
    if (!property) return;
    if (confirm("Delete this photo?")) {
      await deletePhotoMutation.mutateAsync({ id: property.id, url });
    }
  };

  const handlePhotoMove = async (index: number, direction: -1 | 1) => {
    if (!property?.photos) return;
    const target = index + direction;
    if (target < 0 || target >= property.photos.length) return;
    const photos = [...property.photos];
    [photos[index], photos[target]] = [photos[target], photos[index]];
    await reorderPhotosMutation.mutateAsync({ id: property.id, photos });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <button onClick={() => setLocation("/agent")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-display font-bold text-foreground mb-8">
          {property ? "Edit Listing" : "Create Listing"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Photos Section for existing property */}
          {property && (
            <div id="photos" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Property Photos</h3>
                <span className="text-sm text-muted-foreground">{property.photos?.length || 0} / 20</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {property.photos?.map((photo, index) => (
                  <div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handlePhotoMove(index, -1)}
                        disabled={index === 0 || reorderPhotosMutation.isPending}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full disabled:opacity-30"
                        aria-label="Move photo earlier"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePhotoMove(index, 1)}
                        disabled={index === property.photos!.length - 1 || reorderPhotosMutation.isPending}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full disabled:opacity-30"
                        aria-label="Move photo later"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePhotoDelete(photo)}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(property.photos?.length || 0) < 20 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPhotosMutation.isPending}
                    className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
                  >
                    {uploadPhotosMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                    <span className="text-xs font-bold mt-2">Add Photo</span>
                  </button>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                />
              </div>
              {uploadPhotosMutation.isPending && (
                <div className="flex items-center gap-2 text-sm font-semibold text-primary" role="status">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Optimizing and uploading photos…
                </div>
              )}
            </div>
          )}
          {!property && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20 p-4 text-sm text-blue-800 dark:text-blue-300">
              Start with the property details and save as a draft. You can then add, reorder, and remove up to 20 device photos before publishing.
            </div>
          )}

          {/* Status & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="coming_soon">Coming Soon</option>
                <option value="pre_market">Pre-Market</option>
                <option value="off_market">Off Market</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Property Type</label>
              <select
                value={formData.propertyType}
                onChange={e => setFormData({ ...formData, propertyType: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="SFH">Single Family Home</option>
                <option value="Condo">Condo</option>
                <option value="Townhome">Townhome</option>
                <option value="Multi-Family">Multi-Family</option>
                <option value="Land">Land</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(formData.status === "coming_soon" || formData.status === "pre_market") && (
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-1.5">Expected market date</label>
                <input
                  type="date"
                  value={formData.listDate}
                  onChange={e => setFormData({ ...formData, listDate: e.target.value })}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Open house date</label>
              <input
                type="date"
                value={formData.openHouseDate}
                onChange={e => setFormData({ ...formData, openHouseDate: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Open house time</label>
              <input
                type="text"
                value={formData.openHouseTime}
                onChange={e => setFormData({ ...formData, openHouseTime: e.target.value })}
                placeholder="11:00 AM – 2:00 PM"
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Property Location</label>
              <input
                ref={inputRef}
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                placeholder="Start typing an address..."
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Title / Headline</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                placeholder="e.g. Stunning Craftsman with Ocean Views"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Price ($)</label>
              <input
                type="number"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Beds</label>
              <input
                type="number"
                value={formData.beds}
                onChange={e => setFormData({ ...formData, beds: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Baths</label>
              <input
                type="number"
                step="0.5"
                value={formData.baths}
                onChange={e => setFormData({ ...formData, baths: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Sqft</label>
              <input
                type="number"
                value={formData.sqft}
                onChange={e => setFormData({ ...formData, sqft: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Lot Size</label>
              <input
                type="number"
                value={formData.lotSize}
                onChange={e => setFormData({ ...formData, lotSize: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">HOA Fee /mo</label>
              <input
                type="number"
                value={formData.hoaFee}
                onChange={e => setFormData({ ...formData, hoaFee: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-muted-foreground mb-1.5">Public Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary h-32 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-muted-foreground mb-1.5">Virtual tour URL (optional)</label>
            <input
              type="url"
              value={formData.virtualTourUrl}
              onChange={e => setFormData({ ...formData, virtualTourUrl: e.target.value })}
              placeholder="https://"
              className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          {/* Confidential Agent Info */}
          <div className="border-t border-border pt-8 mt-8 space-y-6">
            <h3 className="text-xl font-display font-bold text-foreground">Agent Confidential Information</h3>
            <p className="text-sm text-muted-foreground -mt-2 mb-4">This information is private and visible only to you as the listing owner.</p>
            
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-1.5">Confidential Remarks</label>
              <textarea
                value={formData.confidentialRemarks}
                onChange={e => setFormData({ ...formData, confidentialRemarks: e.target.value })}
                className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary h-24 resize-none"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-1.5">Showing Instructions</label>
                <textarea
                  value={formData.showingInstructions}
                  onChange={e => setFormData({ ...formData, showingInstructions: e.target.value })}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary h-24 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-1.5">Access Instructions (Lockbox, Gate Code)</label>
                <textarea
                  value={formData.accessInstructions}
                  onChange={e => setFormData({ ...formData, accessInstructions: e.target.value })}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary h-24 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Buyer-facing review</p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg">{formData.title || "Your listing headline"}</h3>
                <p className="text-sm text-muted-foreground">{formData.location || "Property address"}</p>
                <p className="text-sm font-semibold mt-1">
                  {formData.beds || "0"} beds · {formData.baths || "0"} baths · {Number(formData.sqft || 0).toLocaleString()} sq ft
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-display font-bold text-xl">${Number(formData.price || 0).toLocaleString()}</p>
                <p className="text-xs font-bold text-primary capitalize">{formData.status.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-border gap-4">
            <button
              type="button"
              onClick={() => setLocation("/agent")}
              className="px-6 py-3 font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 bg-foreground text-background px-8 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {property ? "Save Changes" : formData.status === "draft" ? "Save Draft" : "Publish Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
