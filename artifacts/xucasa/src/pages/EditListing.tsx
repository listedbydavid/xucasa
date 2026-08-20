import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useProperty, useUpdateProperty } from "@/hooks/use-properties";
import { useDirectPhotoUpload } from "@/hooks/use-direct-photo-upload";
import { useRemoveListingPhoto, useArchiveAgentListing } from "@workspace/api-client-react";
import { 
  CheckCircle2, MapPin, Home, DollarSign, Image as ImageIcon, 
  Loader2, Trash2, AlertCircle, EyeOff, Archive, Undo
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  usePageMeta({ title: "Edit Listing | Agent Portal" });
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const propertyId = parseInt(id || "0", 10);
  const { data: property, isLoading: isPropertyLoading } = useProperty(propertyId);
  const { mutate: updateProperty, isPending: isUpdating } = useUpdateProperty();
  const archiveListing = useArchiveAgentListing();
  const isArchived = property?.listingStatus === "archived" || property?.status === "archived";
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    addressStreetNumber: "",
    addressStreetName: "",
    addressUnitNumber: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    beds: "",
    baths: "",
    sqft: "",
    lotSize: "",
    yearBuilt: "",
    hoaFee: "",
    status: "active" as "active" | "coming_soon" | "off_market" | "pending" | "sold" | "archived",
    arv: "",
    estimatedRepairCost: "",
    investorNotes: "",
    expectedListDate: "",
    expectedMlsNumber: "",
  });

  useEffect(() => {
    if (property) {
      setFormData({
        title: property.title || "",
        description: property.description || "",
        price: property.price?.toString() || "",
        addressStreetNumber: (property as any).addressStreetNumber || "",
        addressStreetName: (property as any).addressStreetName || "",
        addressUnitNumber: (property as any).addressUnitNumber || "",
        addressCity: (property as any).addressCity || "",
        addressState: (property as any).addressState || "",
        addressZip: (property as any).addressZip || "",
        beds: property.beds?.toString() || "",
        baths: property.baths?.toString() || "",
        sqft: property.sqft?.toString() || "",
        lotSize: (property as any).lotSize?.toString() || "",
        yearBuilt: (property as any).yearBuilt?.toString() || "",
        hoaFee: (property as any).hoaFee?.toString() || "",
        status: (property.isOffMarket ? "off_market" : property.listingStatus) as any || "active",
        arv: (property as any).arv?.toString() || "",
        estimatedRepairCost: (property as any).estimatedRepairCost?.toString() || "",
        investorNotes: (property as any).investorNotes || "",
        expectedListDate: (property as any).expectedListDate || "",
        expectedMlsNumber: (property as any).expectedMlsNumber || "",
      });
    }
  }, [property]);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const { uploadPhotos, isUploading } = useDirectPhotoUpload();
  const removePhoto = useRemoveListingPhoto();

  const handleUpdateProperty = () => {
    if (isArchived) {
      toast({ title: "Archived listings are read-only.", variant: "destructive" });
      return;
    }
    updateProperty({
      id: propertyId,
      title: formData.title,
      description: formData.description,
      price: parseInt(formData.price) || 0,
      location: `${formData.addressStreetName}, ${formData.addressCity}, ${formData.addressState} ${formData.addressZip}`,
      beds: parseInt(formData.beds) || 0,
      baths: parseFloat(formData.baths) || 0,
      sqft: parseInt(formData.sqft) || 0,
      lotSize: parseInt(formData.lotSize) || undefined,
      yearBuilt: parseInt(formData.yearBuilt) || undefined,
      hoaFee: parseInt(formData.hoaFee) || undefined,
      status: ["active", "pending", "sold", "archived"].includes(formData.status) ? formData.status : "pre_market",
      listingStatus: formData.status,
      isOffMarket: formData.status === "off_market",
      arv: parseInt(formData.arv) || undefined,
      estimatedRepairCost: parseInt(formData.estimatedRepairCost) || undefined,
      investorNotes: formData.investorNotes || undefined,
      expectedListDate: formData.expectedListDate || undefined,
      expectedMlsNumber: formData.expectedMlsNumber || undefined,
    }, {
      onSuccess: () => {
        toast({ title: "Listing updated successfully." });
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(newFiles);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
      
      try {
        await uploadPhotos(propertyId, newFiles);
        toast({ title: "Photos uploaded successfully!" });
        setFiles([]);
        setPreviews([]);
      } catch (err) {
        toast({ title: "Photo upload failed", variant: "destructive" });
      }
    }
  };

  const handleRemoveExistingPhoto = async (photoUrl: string) => {
    try {
      await removePhoto.mutateAsync({ id: propertyId, data: { photoUrl } });
      toast({ title: "Photo removed" });
    } catch (err) {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    if (confirm("Are you sure you want to archive this listing? It will no longer be visible to buyers.")) {
      try {
        await archiveListing.mutateAsync({ id: propertyId, data: { reason: "owner_archived" } });
        toast({ title: "Listing archived" });
        setLocation("/agent");
      } catch (err) {
        toast({ title: "Failed to archive", variant: "destructive" });
      }
    }
  };

  if (isPropertyLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!property || (property.agentId !== user?.id && user?.role !== 'admin')) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-3xl font-display font-bold mb-2">Not Authorized</h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          You don't have permission to edit this listing.
        </p>
        <button onClick={() => setLocation("/agent")} className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold">
          Go to Agent Portal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="max-w-4xl mx-auto px-4 pt-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Edit Listing</h1>
            <p className="text-muted-foreground mt-1">{property.title || property.location}</p>
          </div>
          <div className="flex gap-2">
            {formData.status !== "archived" && (
              <button 
                onClick={handleArchive}
                className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground hover:bg-destructive hover:text-white rounded-full font-bold text-sm transition-colors border border-border"
              >
                <Archive className="w-4 h-4" /> Archive
              </button>
            )}
            <button 
              onClick={handleUpdateProperty}
              disabled={isUpdating || isArchived}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><CheckCircle2 className="w-4 h-4" /> {isArchived ? "Archived — Read Only" : "Save Changes"}</>}
            </button>
          </div>
        </div>

        {isArchived && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This listing is archived and preserved as a read-only record.
          </div>
        )}

        <fieldset disabled={isArchived} className="contents">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Home className="w-5 h-5 text-primary" /> Basics</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Headline / Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Price</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Beds</label>
                  <input type="number" value={formData.beds} onChange={(e) => setFormData(prev => ({ ...prev, beds: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Baths</label>
                  <input type="number" step="0.5" value={formData.baths} onChange={(e) => setFormData(prev => ({ ...prev, baths: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">SqFt</label>
                  <input type="number" value={formData.sqft} onChange={(e) => setFormData(prev => ({ ...prev, sqft: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Lot Size</label>
                  <input type="number" value={formData.lotSize} onChange={(e) => setFormData(prev => ({ ...prev, lotSize: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Year Built</label>
                  <input type="number" value={formData.yearBuilt} onChange={(e) => setFormData(prev => ({ ...prev, yearBuilt: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">HOA (/mo)</label>
                  <input type="number" value={formData.hoaFee} onChange={(e) => setFormData(prev => ({ ...prev, hoaFee: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:border-primary" />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Photos</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {(property.photos || (property.imageUrl ? [property.imageUrl] : [])).map((url: string, i: number) => (
                  <div key={i} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => handleRemoveExistingPhoto(url)}
                        className="w-8 h-8 bg-destructive text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {isUploading && previews.map((url, i) => (
                  <div key={`prev-${i}`} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={url} alt="" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-6 text-center">
                <input
                  type="file"
                  id="photo-upload-edit"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="photo-upload-edit" className="cursor-pointer inline-flex flex-col items-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="font-bold text-sm bg-muted text-foreground px-4 py-2 rounded-full">Add Photos</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-display font-bold mb-4">Lifecycle</h2>
              
              <div className="space-y-3">
                {(["active", "coming_soon", "off_market", "pending", "sold"] as const).map(status => (
                  <label key={status} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.status === status ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}>
                    <input 
                      type="radio" 
                      name="status" 
                      value={status}
                      checked={formData.status === status}
                      onChange={() => setFormData(prev => ({ ...prev, status }))}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="font-bold text-sm capitalize">{status.replace("_", " ")}</span>
                  </label>
                ))}
              </div>

              {["off_market", "coming_soon"].includes(formData.status) && (
                <div className="mt-6 pt-6 border-t border-border space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold mb-1">Expected List Date</label>
                    <input
                      type="date"
                      value={formData.expectedListDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedListDate: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary"
                    />
                  </div>
                  
                  {formData.status === "off_market" && (
                    <>
                      <div>
                        <label className="block text-xs font-bold mb-1">ARV</label>
                        <input type="number" value={formData.arv} onChange={(e) => setFormData(prev => ({ ...prev, arv: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Repair Cost</label>
                        <input type="number" value={formData.estimatedRepairCost} onChange={(e) => setFormData(prev => ({ ...prev, estimatedRepairCost: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </fieldset>
      </div>
    </div>
  );
}
