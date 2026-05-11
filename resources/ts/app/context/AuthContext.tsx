import { createContext, useContext, useState, ReactNode } from 'react';
import { API, HEADERS } from '../lib/api';

export type UserRole = 'hr' | 'employee' | 'supervisor' | 'gm' | 'accounting';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
  outlet?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (userId: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Built-in system accounts (cannot be deleted, always available)
const SYSTEM_ACCOUNTS: Record<string, { user: AuthUser; password: string }> = {
  'admin': {
    user: { id: 'SYS-HR', name: 'HR Admin', email: 'admin', role: 'hr' },
    password: 'admin123',
  },
  'hr@company.com': {
    user: { id: 'SYS-HR', name: 'HR Admin', email: 'hr@company.com', role: 'hr' },
    password: 'password',
  },
  'employee@company.com': {
    user: { id: 'SYS-EMP', name: 'Juan Dela Cruz', email: 'employee@company.com', role: 'employee' },
    password: 'password',
  },
  'supervisor@company.com': {
    user: { id: 'SYS-SUP', name: 'Maria Santos', email: 'supervisor@company.com', role: 'supervisor' },
    password: 'password',
  },
  'gm@company.com': {
    user: { id: 'SYS-GM', name: 'General Manager', email: 'gm@company.com', role: 'gm' },
    password: 'password',
  },
  'accounting@company.com': {
    user: { id: 'SYS-ACC', name: 'Accounting Staff', email: 'accounting@company.com', role: 'accounting' },
    password: 'password',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = async (email: string, password: string) => {
    // 1. Check system (built-in) accounts
    const systemMatch = SYSTEM_ACCOUNTS[email.trim().toLowerCase()] || SYSTEM_ACCOUNTS[email.trim()];
    if (systemMatch && password === systemMatch.password) {
      setUser(systemMatch.user);
      return;
    }

    // 2. Check KV-stored user accounts (created by HR)
    try {
      const res = await fetch(`${API}/users`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const users: any[] = data.users ?? [];
        const found = users.find(
          (u: any) =>
            (u.email?.toLowerCase() === email.trim().toLowerCase() ||
             u.username?.toLowerCase() === email.trim().toLowerCase()) &&
            u.password === password &&
            u.active !== false
        );
        if (found) {
          setUser({
            id: found.id,
            name: found.name,
            email: found.email,
            role: found.role as UserRole,
            employeeId: found.employeeId ?? null,
            outlet: found.outlet ?? null,
          });
          return;
        }
      }
    } catch (_) {
      // If KV lookup fails, fall through to throw below
    }

    throw new Error('Invalid credentials');
  };

  const logout = () => {
    setUser(null);
  };

  const changePassword = async (userId: string, newPassword: string) => {
    const res = await fetch(`${API}/users/${userId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to change password');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
