import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  upi_id?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const storedToken = localStorage.getItem('open_notes_token');
      const storedUser = localStorage.getItem('open_notes_user');

      if (storedToken && storedUser) {
        try {
          // Quick health check/profile check to verify status
          const res = await fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          
          if (res.status === 403) {
            const data = await res.json();
            if (data.error === 'ACCOUNT_BLOCKED') {
              logout();
              return;
            }
          }

          if (res.ok) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else if (res.status === 401) {
            logout(); // Token expired or invalid
          }
        } catch (error) {
          console.error('Initial auth check failed:', error);
          // Don't logout on network error, keep offline state
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      }
      setIsLoading(false);
    };

    checkStatus();
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('open_notes_token', newToken);
    localStorage.setItem('open_notes_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('open_notes_token');
    localStorage.removeItem('open_notes_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
