import { createContext, useContext, useState, type ReactNode } from "react";

export type PreviewRole = "buyer" | "homeowner" | "agent" | "explorer" | null;

interface PreviewContextValue {
  previewRole: PreviewRole;
  setPreviewRole: (role: PreviewRole) => void;
  effectiveRole: string | null;
  isPreviewActive: boolean;
}

const PreviewContext = createContext<PreviewContextValue>({
  previewRole: null,
  setPreviewRole: () => {},
  effectiveRole: null,
  isPreviewActive: false,
});

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(() => {
    try {
      const stored = sessionStorage.getItem("xucasa_preview_role");
      if (stored === "buyer" || stored === "homeowner" || stored === "agent" || stored === "explorer") {
        return stored;
      }
      return null;
    } catch {
      return null;
    }
  });

  const setPreviewRole = (role: PreviewRole) => {
    setPreviewRoleState(role);
    try {
      if (role) sessionStorage.setItem("xucasa_preview_role", role);
      else sessionStorage.removeItem("xucasa_preview_role");
    } catch {
      // ignore storage errors
    }
  };

  return (
    <PreviewContext.Provider
      value={{
        previewRole,
        setPreviewRole,
        effectiveRole: previewRole,
        isPreviewActive: previewRole !== null,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

export const usePreview = () => useContext(PreviewContext);
