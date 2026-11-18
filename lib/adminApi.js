const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5050/api").replace(/\/$/, "");
const TOKEN_KEY = "hms_platform_admin_token";

const messageFor = async (response) => {
  const body = await response.json().catch(() => ({}));
  return body?.message || "The request could not be completed.";
};

// Error carrying the HTTP status and the API's machine-readable `code`
// (e.g. ADD_ON_PERIOD_ENDED) so pages can react to specific failures.
const apiError = async (response) => {
  const body = await response.json().catch(() => ({}));
  const error = new Error(body?.message || "The request could not be completed.");
  error.status = response.status;
  error.code = body?.code || "";
  return error;
};

export const getAdminToken = () =>
  typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_KEY) || "";

export const clearAdminToken = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
};

const request = async (path, options = {}) => {
  const token = getAdminToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw await apiError(response);
  const body = await response.json();
  return body?.data ?? body;
};

export const signInPlatformAdmin = async ({ email, password }) => {
  const response = await fetch(`${API_BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await messageFor(response));
  const body = await response.json();
  const token = body?.data?.token;
  if (!token) throw new Error("The API did not return a session token.");
  window.localStorage.setItem(TOKEN_KEY, token);
  try {
    await request("/subscriptionPayment/admin/all");
  } catch (error) {
    clearAdminToken();
    throw error;
  }
};

export const getPaymentRequests = () => request("/subscriptionPayment/admin/all");
export const getPaymentRequest = (id) => request(`/subscriptionPayment/admin/get/${id}`);
export const approvePaymentRequest = (id) => request(`/subscriptionPayment/approve/${id}`, { method: "PUT", body: "{}" });
export const rejectPaymentRequest = (id, reason) => request(`/subscriptionPayment/reject/${id}`, { method: "PUT", body: JSON.stringify({ reason }) });

export const getPaymentProof = async (proofUrl) => {
  const token = getAdminToken();
  const response = await fetch(proofUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await messageFor(response));
  return URL.createObjectURL(await response.blob());
};
