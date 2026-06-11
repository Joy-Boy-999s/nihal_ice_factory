import Cookies from 'js-cookie';
import { useSyncExternalStore } from 'react';

const TOKEN_KEY = 'accessToken';
const ROLE_KEY = 'userRole';
const EVENT = 'auth:changed';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event(EVENT));
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function getRole(): string {
  return Cookies.get(ROLE_KEY)?.toUpperCase() || 'USER';
}

export function login(token: string, role: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'Strict' });
  Cookies.set(ROLE_KEY, role, { expires: 7, sameSite: 'Strict' });
  notify();
}

export function logout(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(ROLE_KEY);
  notify();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  return getRole() === 'ADMIN';
}

export function isCustomer(): boolean {
  return getRole() === 'CUSTOMER';
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  window.addEventListener(EVENT, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(EVENT, listener);
  };
}

export interface AuthSnapshot {
  authenticated: boolean;
  role: string;
  token: string | undefined;
}

function getSnapshot(): AuthSnapshot {
  return {
    authenticated: isAuthenticated(),
    role: getRole(),
    token: getToken(),
  };
}

// Cache snapshot so useSyncExternalStore doesn't loop.
let cached: AuthSnapshot = getSnapshot();
let cachedKey = `${cached.authenticated}|${cached.role}|${cached.token ?? ''}`;

function getCachedSnapshot(): AuthSnapshot {
  const next = getSnapshot();
  const key = `${next.authenticated}|${next.role}|${next.token ?? ''}`;
  if (key !== cachedKey) {
    cached = next;
    cachedKey = key;
  }
  return cached;
}

export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getCachedSnapshot, getCachedSnapshot);
}

export function getUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // JWT payload is base64url-encoded — replace URL-safe chars before decoding
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    // NestJS default: userId in 'sub'
    const id = payload['sub'] ?? payload['userId'] ?? payload['id'];
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

export function buildAuthConfig() {
  const token = getToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
}
