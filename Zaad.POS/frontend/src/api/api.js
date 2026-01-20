const api = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { ...options, headers });
  return res.json();
};

// إذا كنت تستخدم `setToken` خارج هذا الملف، تحتاج لتحديده وتصديره
export const setToken = (token) => {
  localStorage.setItem("token", token);
};

export default api;
