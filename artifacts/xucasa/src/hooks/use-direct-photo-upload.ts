import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useDirectPhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const uploadPhotos = async (propertyId: number, files: File[]) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("photos", file));

      const res = await fetch(`/api/properties/${propertyId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to upload photos");
      }
      
      const data = await res.json();
      
      // Invalidate property queries
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      
      return data;
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  return { uploadPhotos, isUploading, progress };
}
