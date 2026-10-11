import { createContext, useContext, useEffect, useState } from "react";
import { api, get } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sm_access");
    if (!token) { setLoading(false); return; }
    get("/me/")
      .then(setUser)
      .catch(() => localStorage.removeItem("sm_access"))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { data } = await api.post("/token/", { username, password });
    localStorage.setItem("sm_access", data.access);
    localStorage.setItem("sm_refresh", data.refresh);
    const me = await get("/me/");
    setUser(me);
    return me;
  }

  function logout() {
    localStorage.removeItem("sm_access");
    localStorage.removeItem("sm_refresh");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const ROLES = {
  MANAGERS: ["SCHOOL_ADMIN", "DIRECTOR"],
  STAFF: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT"],
  GRADES: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
  FINANCE: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
};

/** Le super admin a accès à tout. */
export const can = (user, roles) =>
  !user || !roles || user.role === "SUPER_ADMIN" || roles.includes(user.role);