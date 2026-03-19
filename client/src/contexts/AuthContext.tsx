import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '../utils/api.js';

export interface User {
  id: string;
  email: string;
  name: string;
  upi_id?: string;
  mobile_number?: string;
  location?: string;
  profile_image_url?: string;
  role?: string;
  has_password?: boolean;
}


interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const storedUser = localStorage.getItem('open_notes_user');

      if (storedUser) {
        try {
          // Verify session via API
          const res = await apiRequest('/api/users/me');
          
          if (res.status === 403) {
            const data = await res.json();
            if (data.error === 'ACCOUNT_BLOCKED') {
              logout();
              return;
            }
          }

          if (res.ok) {
            const freshUser = await res.json();
            setUser(freshUser);
            localStorage.setItem('open_notes_user', JSON.stringify(freshUser));
          } else {
            logout(); // Session expired
          }
        } catch (error) {
          console.error('Initial auth check failed:', error);
          setUser(JSON.parse(storedUser));
        }
      }
      setIsLoading(false);
    };

    checkStatus();
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('open_notes_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('open_notes_user');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiRequest('/api/users/me');
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem('open_notes_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
