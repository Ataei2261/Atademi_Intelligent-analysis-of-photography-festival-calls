import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { VALID_PASSWORDS, PASSWORD_EXPIRY_DURATION_MS } from '../constants';
import { PasswordActivations, PasswordActivationInfo, ActiveSession } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  authenticatedUser: string | null;
  isLoadingAuth: boolean;
  loginError: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [passwordActivations, setPasswordActivations] = useLocalStorage<PasswordActivations>('appPasswordActivations', {});
  const [activeSession, setActiveSession, storageErrorActiveSession] = useLocalStorage<ActiveSession | null>('appActiveSession', null);
   // We don't directly use storageErrorPasswordActivations but it's good to get it from useLocalStorage
  const [, , storageErrorPasswordActivations] = useLocalStorage<PasswordActivations>('appPasswordActivations', {});


  useEffect(() => {
    setIsLoadingAuth(true);
    if (activeSession && activeSession.password && activeSession.user) {
      const activationInfo = passwordActivations[activeSession.password];
      if (activationInfo && VALID_PASSWORDS[activeSession.password] === activeSession.user) {
        const now = Date.now();
        if (now - activationInfo.activatedAt < PASSWORD_EXPIRY_DURATION_MS) {
          setIsAuthenticated(true);
          setAuthenticatedUser(activationInfo.user);
        } else {
          // Password expired
          setActiveSession(null); // Clear expired session
          setIsAuthenticated(false);
          setAuthenticatedUser(null);
        }
      } else {
        // Session data inconsistent or password not in known list
        setActiveSession(null);
        setIsAuthenticated(false);
        setAuthenticatedUser(null);
      }
    } else {
      setIsAuthenticated(false);
      setAuthenticatedUser(null);
    }
    setIsLoadingAuth(false);
  }, []); // Run only on mount to check existing session

  const login = useCallback(async (password: string) => {
    setLoginError(null);
    if (!VALID_PASSWORDS[password]) {
      setLoginError("رمز عبور نامعتبر است.");
      return;
    }

    const userIdentifier = VALID_PASSWORDS[password];
    let activationInfo = passwordActivations[password];
    const now = Date.now();

    if (activationInfo) { // Password has been used before
      if (now - activationInfo.activatedAt >= PASSWORD_EXPIRY_DURATION_MS) {
        setLoginError(`این رمز عبور منقضی شده است. (کاربر: ${userIdentifier})`);
        // Optionally, clear the expired password from activations to allow re-use if policies change (not done here)
        return;
      }
      // If not expired, re-use existing activation info
    } else { // First time use
      activationInfo = { activatedAt: now, user: userIdentifier };
      setPasswordActivations(prev => ({ ...prev, [password]: activationInfo! }));
    }

    setIsAuthenticated(true);
    setAuthenticatedUser(userIdentifier);
    setActiveSession({ password, user: userIdentifier });
  }, [passwordActivations, setPasswordActivations, setActiveSession]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAuthenticatedUser(null);
    setActiveSession(null); // Clear the active session from localStorage
    // Password activations remain to enforce expiry
  }, [setActiveSession]);

  if (storageErrorActiveSession || storageErrorPasswordActivations) {
    // Handle critical storage errors, maybe by forcing logout or showing an error UI
    // For now, logging it. These might be shown through FestivalContext's storageError as well.
    console.error("Storage error in AuthProvider:", storageErrorActiveSession, storageErrorPasswordActivations);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, authenticatedUser, isLoadingAuth, login, logout, loginError }}>
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
