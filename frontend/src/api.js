import axios from "axios";
import { useCallback, useEffect, useState } from "react";

const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sm_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry
        && !original.url?.includes("/token")) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${baseURL}/token/refresh/`, {
          refresh: localStorage.getItem("sm_refresh"),
        });
        localStorage.setItem("sm_access", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        localStorage.removeItem("sm_access");
        localStorage.removeItem("sm_refresh");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, data) => api.post(url, data).then((r) => r.data);
export const patch = (url, data) => api.patch(url, data).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);

/** Récupère toutes les pages d'une liste paginée (petits volumes). */
export async function getAll(url, params = {}) {
  let results = [], page = 1, next = true;
  while (next && page <= 20) {
    const data = await get(url, { ...params, page });
    results = results.concat(data.results || []);
    next = !!data.next;
    page++;
  }
  return results;
}

/** Télécharge un fichier protégé (PDF, Excel) avec le token JWT. */
export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Transforme l'URL absolue d'une photo en chemin relatif (fonctionne en local, via tunnel, en ligne). */
export const mediaUrl = (url) => {
  if (!url) return null;
  try { return new URL(url, window.location.origin).pathname; } catch { return url; }
};

export const errMessage = (e) => {
  if (!e?.response) return "Impossible de joindre le serveur.";
  const data = e.response.data;
  if (typeof data === "string")
    return data.length > 300 ? `Erreur serveur (${e.response.status}).` : data;
  if (data && typeof data === "object")
    return Object.values(data).flat()
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join(" ");
  return `Erreur ${e.response.status}.`;
};

/** Hook générique de liste paginée + recherche + rechargement. */
export function useList(endpoint, params = {}) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(input); }, 400);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    get(endpoint, { ...JSON.parse(paramsKey), page, search: query || undefined })
      .then((data) => {
        if (!alive) return;
        setItems(data.results || []);
        setCount(data.count || 0);
        setNext(data.next);
        setPrevious(data.previous);
        setError("");
      })
      .catch((e) => alive && setError(errMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [endpoint, paramsKey, page, query, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { items, count, next, previous, page, setPage, loading, error, input, setInput, reload };
}