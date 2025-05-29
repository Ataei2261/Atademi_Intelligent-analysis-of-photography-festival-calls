
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { VALID_PASSWORDS, PASSWORD_EXPIRY_DURATION_MS } from '../constants';
import { PasswordActivations, PasswordActivationInfo, ActiveSession } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  authenticatedUser: string | null;
  isLoadingAuth: boolean;
  loginError: string | null;
  sessionExpiryTimestamp: number | null; // Added for countdown timer
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [sessionExpiryTimestamp, setSessionExpiryTimestamp] = useState<number | null>(null); // State for expiry timestamp

  const [passwordActivations, setPasswordActivations, storageErrorPasswordActivations] = useLocalStorage<PasswordActivations>('appPasswordActivations_v2', {});
  const [activeSession, setActiveSession, storageErrorActiveSession] = useLocalStorage<ActiveSession | null>('appActiveSession_v2', null);

  useEffect(() => {
    setIsLoadingAuth(true);
    if (activeSession && activeSession.password && activeSession.user) {
      const activationInfo = passwordActivations[activeSession.password];
      
      if (activationInfo && 
          activationInfo.activatedBy === activeSession.user &&
          VALID_PASSWORDS[activeSession.password] === activeSession.user) { // Double check consistency
        
        const expiryTime = activationInfo.activatedAt + PASSWORD_EXPIRY_DURATION_MS;
        if (Date.now() < expiryTime) {
          setIsAuthenticated(true);
          setAuthenticatedUser(activationInfo.activatedBy);
          setSessionExpiryTimestamp(expiryTime);
        } else {
          // Session expired
          setActiveSession(null);
          setIsAuthenticated(false);
          setAuthenticatedUser(null);
          setSessionExpiryTimestamp(null);
        }
      } else {
        // Session invalid (e.g., activation info mismatch or password not in VALID_PASSWORDS for this user)
        setActiveSession(null);
        setIsAuthenticated(false);
        setAuthenticatedUser(null);
        setSessionExpiryTimestamp(null);
      }
    } else {
      setIsAuthenticated(false);
      setAuthenticatedUser(null);
      setSessionExpiryTimestamp(null);
    }
    setIsLoadingAuth(false);
  }, [activeSession, passwordActivations, setActiveSession]);

  const login = useCallback(async (password: string) => {
    setLoginError(null);
    if (!VALID_PASSWORDS[password]) {
      setLoginError("رمز عبور نامعتبر است.");
      return;
    }

    const userIdentifier = VALID_PASSWORDS[password];
    const activationInfo = passwordActivations[password];
    let expiryTime: number;

    if (activationInfo) { // Password code has been activated before
      if (activationInfo.activatedBy !== userIdentifier) {
        setLoginError(`این کد رمز عبور قبلاً توسط کاربر دیگری ("${activationInfo.activatedBy}") فعال شده و برای شما معتبر نیست.`);
        return;
      }
      // Activated by the same user, check expiry
      expiryTime = activationInfo.activatedAt + PASSWORD_EXPIRY_DURATION_MS;
      if (Date.now() >= expiryTime) {
        setLoginError(`اعتبار ۲۴ ساعته شما برای این رمز عبور ("${userIdentifier}") به پایان رسیده است.`);
        return;
      }
      // Still valid for this user
      setIsAuthenticated(true);
      setAuthenticatedUser(userIdentifier);
      setActiveSession({ password, user: userIdentifier, sessionStartedAt: Date.now() });
      setSessionExpiryTimestamp(expiryTime);

    } else { // First time this password code is being used by anyone
      const firstActivationTime = Date.now();
      const newActivationInfo: PasswordActivationInfo = { 
        activatedAt: firstActivationTime, 
        activatedBy: userIdentifier 
      };
      setPasswordActivations(prev => ({ ...prev, [password]: newActivationInfo }));

      expiryTime = firstActivationTime + PASSWORD_EXPIRY_DURATION_MS;
      setIsAuthenticated(true);
      setAuthenticatedUser(userIdentifier);
      setActiveSession({ password, user: userIdentifier, sessionStartedAt: Date.now() });
      setSessionExpiryTimestamp(expiryTime);
    }
  }, [passwordActivations, setPasswordActivations, setActiveSession]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAuthenticatedUser(null);
    setActiveSession(null);
    setSessionExpiryTimestamp(null); // Clear expiry timestamp on logout
  }, [setActiveSession]);

  if (storageErrorActiveSession || storageErrorPasswordActivations) {
    console.error("Storage error in AuthProvider:", storageErrorActiveSession, storageErrorPasswordActivations);
    // Consider how to handle critical storage errors if they occur.
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, authenticatedUser, isLoadingAuth, login, logout, loginError, sessionExpiryTimestamp }}>
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
