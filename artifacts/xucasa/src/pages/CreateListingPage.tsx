import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useCreateProperty } from "@/hooks/use-properties";
import { ListingForm } from "@/components/ListingForm";

export default function CreateListingPage() {
  usePageMeta({ title: 'Create Listing', noIndex: true });
  const [, setLocation] = useLocation();
  const { mutateAsync: createProperty, isPending } = useCreateProperty();

  const handleSubmit = async (data: any) => {
    try {
      const result = await createProperty(data);
      if (result && result.id) {
        setLocation(`/agent/listings/${result.id}/edit`);
      } else {
        setLocation("/agent");
      }
    } catch (err) {
      // Error is handled by mutation
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <ListingForm onSubmit={handleSubmit} isPending={isPending} />
    </div>
  );
}