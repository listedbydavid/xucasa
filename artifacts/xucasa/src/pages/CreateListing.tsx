import { useState } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProperty } from "@/hooks/use-properties";
import { useDirectPhotoUpload } from "@/hooks/use-direct-photo-upload";
import { useRemoveListingPhoto } from "@workspace/api-client-react";
import { 
  CheckCircle2, ChevronRight, ChevronLeft, MapPin, 
  Home, DollarSign, Image as ImageIcon, Loader2,
  Trash2, GripVertical, AlertCircle, EyeOff
} from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useToast } from "@/hooks/use-toast";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function CreateListing() {
  usePageMeta({ title: "Create Listing | Agent Portal" });
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>(1);
  const [createdPropertyId, setCreatedPropertyId] = useState<number | null>(null);
  const { mutate: createProperty, isPending: isCreating } = useCreateProperty();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    propertyType: "Single Family",
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
    status: "active" as "active" | "coming_soon" | "off_market",
    arv: "",
    estimatedRepairCost: "",
    investorNotes: "",
    expectedListDate: "",
    expectedMlsNumber: "",
  });

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const { uploadPhotos, isUploading } = useDirectPhotoUpload();

  const handleNext = () => setStep((s) => Math.min(6, s + 1) as Step);
  const handleBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const handleAddressSelect = (place: any) => {
    // Parse Google Maps place to our fields if possible, or just set title as street
    // Simple parsing for this example:
    const parts = place.title.split(",");
    setFormData(prev => ({
      ...prev,
      addressStreetName: parts[0]?.trim() || "",
      addressCity: parts[1]?.trim() || "",
      addressState: parts[2]?.trim().split(" ")[0] || "",
      addressZip: parts[2]?.trim().split(" ")[1] || ""
    }));
  };

  const handleCreateProperty = () => {
    createProperty({
      title: formData.title,
      propertyType: formData.propertyType,
      description: formData.description,
      price: parseInt(formData.price) || 0,
      location: `${formData.addressStreetNumber} ${formData.addressStreetName}, ${formData.addressCity}, ${formData.addressState} ${formData.addressZip}`.trim(),
      addressStreetNumber: formData.addressStreetNumber || undefined,
      addressStreetName: formData.addressStreetName,
      addressUnitNumber: formData.addressUnitNumber || undefined,
      addressCity: formData.addressCity,
      addressState: formData.addressState,
      addressZip: formData.addressZip || undefined,
      beds: parseInt(formData.beds) || 0,
      baths: parseFloat(formData.baths) || 0,
      sqft: parseInt(formData.sqft) || 0,
      lotSize: parseInt(formData.lotSize) || undefined,
      yearBuilt: parseInt(formData.yearBuilt) || undefined,
      hoaFee: parseInt(formData.hoaFee) || undefined,
      status: formData.status === "active" ? "active" : "pre_market",
      listingStatus: formData.status,
      isOffMarket: formData.status === "off_market",
      arv: parseInt(formData.arv) || undefined,
      estimatedRepairCost: parseInt(formData.estimatedRepairCost) || undefined,
      investorNotes: formData.investorNotes || undefined,
      expectedListDate: formData.expectedListDate || undefined,
      expectedMlsNumber: formData.expectedMlsNumber || undefined,
      agentPhone: undefined,
      agentEmail: undefined
    }, {
      onSuccess: (data) => {
        setCreatedPropertyId(data.id);
        handleNext();
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (files.length > 0 && createdPropertyId) {
      try {
        await uploadPhotos(createdPropertyId, files);
        toast({ title: "Photos uploaded successfully!" });
      } catch (err) {
        toast({ title: "Photo upload failed", variant: "destructive" });
        return;
      }
    }
    setLocation("/agent");
  };

  if (user?.role !== "agent" || !user?.agentVerified) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-3xl font-display font-bold mb-2">Verified Agents Only</h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          You must be a verified agent to create new listings. Please complete your agent profile and verification in the Agent Portal.
        </p>
        <button onClick={() => setLocation("/agent")} className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold">
          Go to Agent Portal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-display font-bold text-foreground">Create Listing</h1>
            <span className="text-sm font-bold text-muted-foreground">Step {step} of 6</span>
          </div>
          <div className="h-2 w-full bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 6) * 100}` }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Home className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">The Basics</h2>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2">Headline / Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="e.g. Stunning Coastal Retreat"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Price</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="850000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                  placeholder="Describe what makes this property special..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">Location</h2>
              </div>

              <div className="bg-muted p-4 rounded-xl border border-border mb-6">
                <label className="block text-sm font-bold mb-2 text-muted-foreground">Quick Lookup</label>
                <AddressAutocomplete
                  variant="hero"
                  placeholder="Start typing address..."
                  onSelect={handleAddressSelect}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold mb-2">Street Address</label>
                  <input
                    type="text"
                    value={formData.addressStreetName}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressStreetName: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Unit / Apt</label>
                  <input
                    type="text"
                    value={formData.addressUnitNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressUnitNumber: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">City</label>
                  <input
                    type="text"
                    value={formData.addressCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressCity: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">State</label>
                  <input
                    type="text"
                    value={formData.addressState}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressState: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.addressZip}
                    onChange={(e) => setFormData(prev => ({ ...prev, addressZip: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Home className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">Property Details</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Bedrooms</label>
                  <input
                    type="number"
                    value={formData.beds}
                    onChange={(e) => setFormData(prev => ({ ...prev, beds: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.baths}
                    onChange={(e) => setFormData(prev => ({ ...prev, baths: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Square Feet</label>
                  <input
                    type="number"
                    value={formData.sqft}
                    onChange={(e) => setFormData(prev => ({ ...prev, sqft: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Lot Size (sqft)</label>
                  <input
                    type="number"
                    value={formData.lotSize}
                    onChange={(e) => setFormData(prev => ({ ...prev, lotSize: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Year Built</label>
                  <input
                    type="number"
                    value={formData.yearBuilt}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearBuilt: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">HOA Fee (/mo)</label>
                  <input
                    type="number"
                    value={formData.hoaFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, hoaFee: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <AlertCircle className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">Listing Strategy</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <button
                  onClick={() => setFormData(prev => ({ ...prev, status: "active" }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.status === 'active' ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                >
                  <div className="font-bold text-foreground mb-1">Active Listing</div>
                  <div className="text-xs text-muted-foreground">Ready to hit the market and visible to everyone.</div>
                </button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, status: "coming_soon" }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.status === 'coming_soon' ? 'border-purple-500 bg-purple-500/5' : 'border-border bg-background'}`}
                >
                  <div className="font-bold text-foreground mb-1">Coming Soon</div>
                  <div className="text-xs text-muted-foreground">Build anticipation before the official launch.</div>
                </button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, status: "off_market" }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.status === 'off_market' ? 'border-yellow-500 bg-yellow-500/5' : 'border-border bg-background'}`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-foreground mb-1">
                    <EyeOff className="w-4 h-4 text-yellow-500" />
                    Off Market
                  </div>
                  <div className="text-xs text-muted-foreground">Private investor deal, hidden from public search.</div>
                </button>
              </div>

              {formData.status !== "active" && (
                <div className="bg-muted p-6 rounded-2xl border border-border space-y-4 animate-in fade-in slide-in-from-top-4">
                  <h3 className="font-bold text-foreground border-b border-border pb-2">
                    {formData.status === "off_market" ? "Investor Details" : "Pre-Market Details"}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Expected List Date</label>
                      <input
                        type="date"
                        value={formData.expectedListDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, expectedListDate: e.target.value }))}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      />
                    </div>
                    {formData.status === "coming_soon" && (
                      <div>
                        <label className="block text-sm font-bold mb-2">Expected MLS #</label>
                        <input
                          type="text"
                          value={formData.expectedMlsNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, expectedMlsNumber: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>

                  {formData.status === "off_market" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold mb-2">After Repair Value (ARV)</label>
                          <input
                            type="number"
                            value={formData.arv}
                            onChange={(e) => setFormData(prev => ({ ...prev, arv: e.target.value }))}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                            placeholder="e.g. 1200000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold mb-2">Est. Repair Cost</label>
                          <input
                            type="number"
                            value={formData.estimatedRepairCost}
                            onChange={(e) => setFormData(prev => ({ ...prev, estimatedRepairCost: e.target.value }))}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                            placeholder="e.g. 150000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2">Investor Notes (Pro Forma, Cap Rate, etc)</label>
                        <textarea
                          value={formData.investorNotes}
                          onChange={(e) => setFormData(prev => ({ ...prev, investorNotes: e.target.value }))}
                          rows={3}
                          className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary resize-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">Review & Create</h2>
              </div>
              
              <div className="bg-muted p-6 rounded-2xl border border-border">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-display font-bold text-2xl">${parseInt(formData.price || "0").toLocaleString()}</h3>
                    <p className="text-muted-foreground text-sm">{formData.title}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    formData.status === 'active' ? 'bg-primary text-primary-foreground' :
                    formData.status === 'coming_soon' ? 'bg-purple-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>
                    {formData.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-y border-border py-4 mb-4">
                  <div>
                    <p className="text-muted-foreground">Beds</p>
                    <p className="font-bold">{formData.beds || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Baths</p>
                    <p className="font-bold">{formData.baths || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sq Ft</p>
                    <p className="font-bold">{formData.sqft || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Built</p>
                    <p className="font-bold">{formData.yearBuilt || "-"}</p>
                  </div>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Address</p>
                  <p className="font-semibold">{formData.addressStreetName}, {formData.addressCity}, {formData.addressState} {formData.addressZip}</p>
                </div>

                {formData.status === "off_market" && (
                  <div className="mt-4 p-3 bg-background rounded-lg border border-border text-sm">
                    <p className="font-bold mb-2">Investor Deal Metrics</p>
                    <div className="flex gap-4">
                      <div><span className="text-muted-foreground">ARV:</span> ${parseInt(formData.arv || "0").toLocaleString()}</div>
                      <div><span className="text-muted-foreground">Repairs:</span> ${parseInt(formData.estimatedRepairCost || "0").toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm">
                Creating the property record first allows you to securely upload high-resolution photos in the next step.
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <ImageIcon className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-display font-bold">Upload Photos</h2>
              </div>
              
              <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-8 text-center bg-muted/30">
                <input
                  type="file"
                  id="photo-upload"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">Click to browse photos</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Upload up to 20 high-resolution photos. First photo will be the main cover image.
                  </p>
                  <div className="mt-6 px-6 py-2 bg-foreground text-background rounded-full font-bold text-sm">
                    Select Photos
                  </div>
                </label>
              </div>

              {previews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted">
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Cover Photo
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => removeFile(idx)}
                          className="w-8 h-8 bg-destructive text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
            {step > 1 && step < 6 ? (
              <button 
                onClick={handleBack}
                className="px-6 py-2.5 rounded-full font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            {step < 5 ? (
              <button 
                onClick={handleNext}
                className="bg-primary text-primary-foreground px-8 py-2.5 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-md"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : step === 5 ? (
              <button 
                onClick={handleCreateProperty}
                disabled={isCreating}
                className="bg-foreground text-background px-8 py-2.5 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-lg"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Property & Next"}
              </button>
            ) : (
              <button 
                onClick={handleFinish}
                disabled={isUploading}
                className="bg-primary text-primary-foreground px-8 py-2.5 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-lg"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Finish & Upload</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
