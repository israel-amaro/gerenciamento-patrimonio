import { useCallback, useEffect, useState } from "react";

export const useAsyncData = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await loader();
      setData(result);
    } catch (err) {
      setError(err.message || "Ocorreu um erro.");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
};
