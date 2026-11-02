import { useEffect, useState } from "react";

const NAVIGATION_EVENT = "eventify:navigate";

export function navigate(path, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
  const hash = window.location.hash.slice(1);
  if (hash) {
    requestAnimationFrame(() => {
      try {
        document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
      } catch {
        window.scrollTo(0, 0);
      }
    });
  } else {
    window.scrollTo(0, 0);
  }
}

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    window.addEventListener(NAVIGATION_EVENT, updatePath);
    return () => {
      window.removeEventListener("popstate", updatePath);
      window.removeEventListener(NAVIGATION_EVENT, updatePath);
    };
  }, []);

  return pathname;
}
