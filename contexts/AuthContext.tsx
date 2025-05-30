
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { ActiveSession, AuthContextType } from '../types';
import { verifyPassword } from '../services/authService';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'auth-session-v2'; 
const LEGACY_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (fallback)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storedSession, setStoredSession, storageError] = useLocalStorage<ActiveSession | null>(SESSION_KEY, null);
  const [activeSession, setActiveSession] = useState<ActiveSession>({ isAuthenticated: false });
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (storageError) {
        console.error("Error with localStorage for session:", storageError);
        setStoredSession(null); 
    }
    if (storedSession && storedSession.isAuthenticated) {
      const now = Date.now();
      let sessionIsValid = false;
      
      // Check activation token first
      if (storedSession.activationToken && storedSession.activationTokenExpiresAt && storedSession.activationTokenExpiresAt > now) {
        sessionIsValid = true;
      } 
      // No valid activation token, check overall key expiry if it exists
      else if (storedSession.sessionExpiresAt && storedSession.sessionExpiresAt > now) {
        // This case implies activation token might be expired or was never there, but the main key is still valid.
        // For a stricter model, we might want to force re-auth if activation token expires.
        // However, if an activation token *was* present and expired, we should log out.
        if (storedSession.activationToken && storedSession.activationTokenExpiresAt && storedSession.activationTokenExpiresAt <= now) {
            console.log("Activation token expired. Session considered invalid despite overall key validity.");
            sessionIsValid = false; 
        } else if (!storedSession.activationToken) { // No activation token, rely on overall key expiry
             sessionIsValid = true;
             console.warn("Active session using overall key expiry (sessionExpiresAt) as activation token is missing.");
        }
      }
      // Fallback for very old legacy sessions (without activation token and without sessionExpiresAt from server)
      else if (!storedSession.activationToken && !storedSession.sessionExpiresAt && storedSession.sessionStartedAt && (now - storedSession.sessionStartedAt < LEGACY_SESSION_DURATION_MS)) {
        sessionIsValid = true;
        console.warn("Active session is a legacy session using client-side duration.");
      }

      if (sessionIsValid) {
        setActiveSession(storedSession);
      } else {
        console.log("Stored session is invalid or expired. Clearing session.");
        setStoredSession(null); 
        setActiveSession({ isAuthenticated: false });
      }
    }
    setIsLoading(false);
  }, [storedSession, setStoredSession, storageError]);

  const login = useCallback(async (password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await verifyPassword(password);
      if (response.success) {
        const now = Date.now();
        let tokenExpiryTimestamp: number | undefined = undefined;
        if (response.activationTokenExpiresAt) {
          tokenExpiryTimestamp = Date.parse(response.activationTokenExpiresAt);
          if (isNaN(tokenExpiryTimestamp)) {
            console.error("Invalid activationTokenExpiresAt received from server:", response.activationTokenExpiresAt);
            setAuthError("خطای داخلی: تاریخ انقضای نامعتبر از سرور دریافت شد.");
            setIsLoading(false);
            return;
          }
        }

        const newSession: ActiveSession = {
          isAuthenticated: true,
          userIdentifier: response.user || password,
          activationToken: response.activationToken,
          activationTokenExpiresAt: tokenExpiryTimestamp,
          sessionStartedAt: now, 
          sessionExpiresAt: response.expiresAt ? Date.parse(response.expiresAt) : undefined, 
        };
        setActiveSession(newSession);
        setStoredSession(newSession);
      } else {
        setAuthError(response.error || 'رمز عبور نامعتبر است یا فعال‌سازی امکان‌پذیر نیست.');
        setActiveSession({ isAuthenticated: false });
        setStoredSession(null);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setAuthError(error.message || 'خطایی در هنگام ورود رخ داد.');
      setActiveSession({ isAuthenticated: false });
      setStoredSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [setStoredSession]);

  const logout = useCallback(() => {
    setActiveSession({ isAuthenticated: false });
    setStoredSession(null);
  }, [setStoredSession]);
  
  useEffect(() => {
    if (activeSession.isAuthenticated) {
      const now = Date.now();
      let soonestValidExpiryMs: number | null = null;
      let expiryTypeForLog = "unknown";

      // Candidate 1: Activation Token Expiry
      if (activeSession.activationToken && activeSession.activationTokenExpiresAt && activeSession.activationTokenExpiresAt > now) {
        soonestValidExpiryMs = activeSession.activationTokenExpiresAt;
        expiryTypeForLog = "activationToken";
      }

      // Candidate 2: Overall Key Expiry (from server, stored in sessionExpiresAt)
      if (activeSession.sessionExpiresAt && activeSession.sessionExpiresAt > now) {
        if (soonestValidExpiryMs === null || activeSession.sessionExpiresAt < soonestValidExpiryMs) {
          soonestValidExpiryMs = activeSession.sessionExpiresAt;
          expiryTypeForLog = "overallKey (sessionExpiresAt)";
        }
      }
      
      // Candidate 3: Legacy client-side session (only if no modern expiries are active)
      // This is less relevant if server always provides one of the above for valid keys.
      if (soonestValidExpiryMs === null && 
          !activeSession.activationToken && 
          !activeSession.sessionExpiresAt && 
          activeSession.sessionStartedAt) {
          const legacyExpiry = activeSession.sessionStartedAt + LEGACY_SESSION_DURATION_MS;
          if (legacyExpiry > now) {
              soonestValidExpiryMs = legacyExpiry;
              expiryTypeForLog = "legacyClientSession";
          }
      }

      if (soonestValidExpiryMs !== null) {
        const timeRemaining = soonestValidExpiryMs - now;
        // timeRemaining should be > 0 due to checks above. 
        // If it's somehow <=0, it means the session is already expired, logout() will handle it soon.
        if (timeRemaining <= 0) { 
          console.log(`Session determined to be already expired by ${expiryTypeForLog}. Logging out.`);
          logout();
          return;
        }

        const timerId = setTimeout(() => {
            console.log(`Session timer expired (type: ${expiryTypeForLog}). Logging out.`);
            logout();
        }, timeRemaining);
        return () => clearTimeout(timerId);
      } else {
        // No valid future expiry found (all are past, or not set, or session structure is unexpected).
        // This implies the session is already invalid based on stored data.
        console.log("No valid future expiry for current session state. Logging out.");
        logout();
      }
    }
  }, [activeSession, logout]);


  return (
    <AuthContext.Provider value={{ activeSession, login, logout, isLoading, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};