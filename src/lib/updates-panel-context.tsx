/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface UpdatesPanelContextType {
  isOpen: boolean;
  activeTab: "updates" | "releases";
  openPanel: (tab?: "updates" | "releases") => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveTab: (tab: "updates" | "releases") => void;
}

const UpdatesPanelContext = createContext<UpdatesPanelContextType | null>(null);

const OPEN_EVENT = "fotopress:open-updates-panel";
const CLOSE_EVENT = "fotopress:close-updates-panel";

/** Função utilitária global para abrir o painel de novidades de qualquer lugar (inclusive callbacks de toast). */
export function openNewsUpdatesPanel(tab?: "updates" | "releases") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { tab: tab ?? "updates" } }));
  }
}

export function closeNewsUpdatesPanel() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
  }
}

export function UpdatesPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"updates" | "releases">("updates");

  const openPanel = (tab?: "updates" | "releases") => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  };

  const closePanel = () => setIsOpen(false);
  const togglePanel = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: "updates" | "releases" }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
      setIsOpen(true);
    };

    const handleClose = () => {
      setIsOpen(false);
    };

    window.addEventListener(OPEN_EVENT, handleOpen);
    window.addEventListener(CLOSE_EVENT, handleClose);

    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpen);
      window.removeEventListener(CLOSE_EVENT, handleClose);
    };
  }, []);

  return (
    <UpdatesPanelContext.Provider
      value={{
        isOpen,
        activeTab,
        openPanel,
        closePanel,
        togglePanel,
        setActiveTab,
      }}
    >
      {children}
    </UpdatesPanelContext.Provider>
  );
}

export function useUpdatesPanel() {
  const context = useContext(UpdatesPanelContext);
  if (!context) {
    return {
      isOpen: false,
      activeTab: "updates" as const,
      openPanel: openNewsUpdatesPanel,
      closePanel: closeNewsUpdatesPanel,
      togglePanel: () => openNewsUpdatesPanel(),
      setActiveTab: () => {},
    };
  }
  return context;
}
