
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { FestivalInfo } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface FestivalsContextType {
  festivals: FestivalInfo[];
  addFestival: (festival: FestivalInfo) => void;
  updateFestival: (updatedFestival: FestivalInfo) => void;
  deleteFestival: (id: string) => void;
  replaceAllFestivals: (newFestivals: FestivalInfo[]) => void; // New function
  getFestivalById: (id: string) => FestivalInfo | undefined;
  isLoading: boolean; // Global loading state for context-managed operations
  setIsLoading: (loading: boolean) => void;
  storageError: Error | null; // To propagate storage errors
}

const FestivalsContext = createContext<FestivalsContextType | undefined>(undefined);

export const FestivalsProvider: React.FC<{ children: ReactNode, onFestivalsChange?: (festivals: FestivalInfo[]) => void }> = ({ children, onFestivalsChange }) => {
  const [festivals, setFestivals, storageError] = useLocalStorage<FestivalInfo[]>('festivals', []);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (onFestivalsChange) {
      onFestivalsChange(festivals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivals, onFestivalsChange]);


  const addFestival = useCallback((festival: FestivalInfo) => {
    setFestivals(prev => [...prev, festival]);
  }, [setFestivals]);

  const updateFestival = useCallback((updatedFestival: FestivalInfo) => {
    setFestivals(prev => prev.map(f => f.id === updatedFestival.id ? updatedFestival : f));
  }, [setFestivals]);

  const deleteFestival = useCallback((idToDelete: string) => {
    console.log(`%c[CONTEXT deleteFestival] CALLED. Attempting to delete ID: "${idToDelete}" (Type: ${typeof idToDelete})`, "color: red; font-weight: bold; font-size: 1.1em;");

    setFestivals(prevFestivals => {
      console.log(`%c[CONTEXT deleteFestival > setFestivals] PREV Festivals (count: ${prevFestivals?.length}):`, "color: orange; font-weight: bold;", prevFestivals?.map(f => ({id: f.id, name: f.festivalName, typeOfId: typeof f.id })));

      if (!Array.isArray(prevFestivals)) {
        console.error("%c[CONTEXT deleteFestival > setFestivals] CRITICAL: prevFestivals is NOT an array!", "color: red; font-size: 1.3em; font-weight: bold;");
        return []; 
      }
      if (prevFestivals.length === 0) {
        console.warn("%c[CONTEXT deleteFestival > setFestivals] PREV Festivals array is EMPTY. No deletion possible.", "color: orange; font-weight: bold;");
        return [];
      }

      let found = false;
      const newFestivals = prevFestivals.filter(f => {
        if (f.id === undefined || f.id === null) {
            console.warn(`%c[CONTEXT deleteFestival > filter] Festival found with undefined/null ID (This item will be kept unless its ID matches 'idToDelete' by chance):`, "color: #ff8c00; font-weight:bold", f);
        }
        // Explicitly check type of f.id
        if (typeof f.id !== 'string') {
             console.warn(`%c[CONTEXT deleteFestival > filter] Festival found with non-string ID (Type: ${typeof f.id}, Value: ${f.id}). This item will be kept unless its ID matches 'idToDelete'. Festival:`, "color: #ff8c00; font-weight:bold", f);
        }

        const match = String(f.id) === idToDelete; // Coerce f.id to string for comparison, though it should be string
        if (match) {
          found = true;
          console.log(`%c[CONTEXT deleteFestival > filter] MATCH FOUND for ID "${idToDelete}". Festival being removed:`, "color: green; font-weight:bold", f);
        }
        return !match; // Keep if NOT a match
      });

      if (found) {
        console.log(`%c[CONTEXT deleteFestival > setFestivals] SUCCESS: ID "${idToDelete}" was found and removed. New list count: ${newFestivals.length}. Previous count: ${prevFestivals.length}`, "color: green; font-weight: bold; font-size: 1.2em;");
        console.log(`%c[CONTEXT deleteFestival > setFestivals] NEW Festivals list:`, "color: green; font-weight:bold", newFestivals?.map(f => ({id: f.id, name: f.festivalName })));
      } else {
        console.warn(`%c[CONTEXT deleteFestival > setFestivals] FAILURE: ID "${idToDelete}" NOT FOUND in the list. No changes made to the festivals list.`, "color: red; font-weight: bold; font-size: 1.2em;");
        // For deeper debugging if IDs *look* the same but aren't matching:
        console.log("%c[CONTEXT deleteFestival > setFestivals] Detailed check for non-matching ID:", "color: orange; font-weight:bold");
        prevFestivals.forEach((f, index) => {
            console.log(`Item ${index}: ID from list = "${f.id}" (Type: ${typeof f.id}), Target ID = "${idToDelete}" (Type: ${typeof idToDelete}), Strict Equal (===): ${f.id === idToDelete}, Coerced Equal (==): ${f.id == idToDelete}, String(f.id) === idToDelete: ${String(f.id) === idToDelete}`);
            if (String(f.id).trim() !== f.id || idToDelete.trim() !== idToDelete) {
                console.warn(`  Potential whitespace issue: List ID trimmed = "${String(f.id).trim()}", Target ID trimmed = "${idToDelete.trim()}"`);
            }
        });
      }
      return newFestivals;
    });
  }, [setFestivals]);

  const replaceAllFestivals = useCallback((newFestivals: FestivalInfo[]) => {
    setFestivals(newFestivals);
  }, [setFestivals]);

  const getFestivalById = useCallback((id: string): FestivalInfo | undefined => {
    return festivals.find(f => f.id === id);
  }, [festivals]);

  const contextValue = useMemo(() => ({
    festivals,
    addFestival,
    updateFestival,
    deleteFestival,
    replaceAllFestivals, // Add to context
    getFestivalById,
    isLoading,
    setIsLoading,
    storageError
  }), [festivals, addFestival, updateFestival, deleteFestival, replaceAllFestivals, getFestivalById, isLoading, setIsLoading, storageError]);

  return (
    <FestivalsContext.Provider value={contextValue}>
      {children}
    </FestivalsContext.Provider>
  );
};

export const useFestivals = (): FestivalsContextType => {
  const context = useContext(FestivalsContext);
  if (!context) {
    throw new Error('useFestivals must be used within a FestivalsProvider');
  }
  return context;
};
