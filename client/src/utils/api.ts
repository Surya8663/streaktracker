const API_BASE = import.meta.env.VITE_API_URL || 'https://streaktracker-back.onrender.com';

export function getApiUrl(path: string): string {
  const baseUrl = API_BASE.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
