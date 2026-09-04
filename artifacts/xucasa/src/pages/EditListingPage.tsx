import { useParams, useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useProperty, useUpdateProperty } from "@/hooks/use-properties";
import { ListingForm } from "@/components/ListingForm";
import { Loader2 } from "lucide-react";

export default function EditListingPage() {
  usePageMeta({ title: 'Edit Listing', noIndex: true });
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : null;
  const [, setLocation] = useLocation();
  
  const { data: property, isLoading } = useProperty(id);
  const { mutateAsync: updateProperty, isPending } = useUpdateProperty();

  const handleSubmit = async (data: any) => {
    if (!id) return;
    try {
      await updateProperty({ id, ...data });
      // Keep them on the page to manage photos, or they can navigate back manually.
      // Wait, we can show a success toast (already handled by mutation) and keep them on the page.
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 pb-20 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-4">Listing not found</h1>
        <button onClick={() => setLocation("/agent")} className="bg-primary text-white px-6 py-2 rounded-full font-bold">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <ListingForm property={property} onSubmit={handleSubmit} isPending={isPending} />
    </div>
  );
}