import { useEffect, useState } from "react";
import { clearSession, readSession, saveSession } from "../lib/api";
import { AuthContext } from "../lib/authContext";

export function AuthProvider({ children }) {
  const [session, setCurrentSession] = useState(readSession);

  useEffect(() => {
    const expireSession = () => setCurrentSession(null);
    window.addEventListener("eventify:session-expired", expireSession);
    return () => window.removeEventListener("eventify:session-expired", expireSession);
  }, []);

  function setSession(nextSession) {
    saveSession(nextSession);
    setCurrentSession(nextSession);
  }

  function logout() {
    clearSession();
    setCurrentSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user || null, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
