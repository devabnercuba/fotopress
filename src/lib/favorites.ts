import { useCallback, useEffect, useState } from "react";

const FAVORITES_STORAGE_KEY = "sports_events_favorite_ids";
const FAVORITES_CHANGED_EVENT = "sports_events_favorites_updated";

function loadFavoritesFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveFavoritesToStorage(favorites: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT));
  } catch {
    // Silently ignore storage quota errors
  }
}

/**
 * Hook para gerenciar estado de favoritos dos eventos esportivos.
 * Sincronizado automaticamente entre componentes via LocalStorage e CustomEvents.
 */
export function useEventFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoritesFromStorage());

  useEffect(() => {
    const handleUpdate = () => {
      setFavorites(loadFavoritesFromStorage());
    };

    window.addEventListener(FAVORITES_CHANGED_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isFavorite = useCallback(
    (eventId: string) => {
      return favorites.has(eventId);
    },
    [favorites],
  );

  const toggleFavorite = useCallback((eventId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      saveFavoritesToStorage(next);
      return next;
    });
  }, []);

  return {
    favorites,
    favoriteCount: favorites.size,
    isFavorite,
    toggleFavorite,
  };
}
