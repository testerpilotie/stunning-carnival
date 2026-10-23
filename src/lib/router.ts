import { useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#/, '') || '/';

/** Hash route split into segments: "#/live/3" → ["live", "3"]. */
export function useRoute(): string[] {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => {
      setPath(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('/').filter(Boolean);
}

export function go(path: string, replace = false) {
  if (replace) window.location.replace('#' + path);
  else window.location.hash = path;
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback, true);
}
