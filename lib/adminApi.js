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

// Tells listeners (the sidebar's refund badge) that refund data or the session changed.
const REFUNDS_CHANGED = "hms:refunds-changed";
export const notifyRefundsChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REFUNDS_CHANGED));
};
export const onRefundsChanged = (listener) => {
  window.addEventListener(REFUNDS_CHANGED, listener);
  return () => window.removeEventListener(REFUNDS_CHANGED, listener);
};

export const clearAdminToken = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
  notifyRefundsChanged();
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
  notifyRefundsChanged();
};

export const getPaymentRequests = () => request("/subscriptionPayment/admin/all");
export const getPaymentRequest = (id) => request(`/subscriptionPayment/admin/get/${id}`);
export const approvePaymentRequest = (id) => request(`/subscriptionPayment/approve/${id}`, { method: "PUT", body: "{}" });
export const rejectPaymentRequest = (id, reason) => request(`/subscriptionPayment/reject/${id}`, { method: "PUT", body: JSON.stringify({ reason }) });

// Fetches an auth-protected file (payment proof, refund screenshot) and returns an object
// URL. The caller revokes it.
export const getProtectedFile = async (fileUrl) => {
  const token = getAdminToken();
  const response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await messageFor(response));
  return URL.createObjectURL(await response.blob());
};
export const getPaymentProof = getProtectedFile;

// Refund requests (subscription cancellations)

const queryString = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

// Accepts `{ cancellations, total, page, limit }`, the same with a `pagination` object, or a
// bare array, and returns `{ items, total, page, limit }`.
export const getRefundRequests = async (params = {}) => {
  const data = await request(`/admin/subscriptionCancellation/all${queryString(params)}`);
  const items = Array.isArray(data) ? data : data?.cancellations ?? data?.items ?? data?.rows ?? [];
  const meta = (Array.isArray(data) ? null : data?.pagination ?? data) || {};
  return {
    items,
    total: Number(meta.total ?? items.length),
    page: Number(meta.page ?? params.page ?? 1),
    limit: Number(meta.limit ?? params.limit ?? items.length),
  };
};

export const getInReviewRefundCount = async () =>
  (await getRefundRequests({ status: "IN_REVIEW", page: 1, limit: 1 })).total;

export const getRefundRequest = async (id) => {
  const data = await request(`/admin/subscriptionCancellation/${id}`);
  return data?.cancellation ?? data;
};

// `image` is a data URL ("data:image/png;base64,..."). Returns the stored proof URL.
export const uploadRefundProof = async (image) => {
  const data = await request("/admin/subscriptionCancellation/proof", { method: "POST", body: JSON.stringify({ image }) });
  const proofUrl = data?.proof_url;
  if (!proofUrl) throw new Error("The API did not return the screenshot URL.");
  return proofUrl;
};

export const markRefundRequestRefunded = async (id, { refundProofUrl, note }) => {
  const result = await request(`/admin/subscriptionCancellation/${id}/refund`, {
    method: "PATCH",
    body: JSON.stringify({ refund_proof_url: refundProofUrl, ...(note ? { note } : {}) }),
  });
  notifyRefundsChanged();
  return result;
};

export const rejectRefundRequest = async (id, rejectionReason) => {
  const result = await request(`/admin/subscriptionCancellation/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ rejection_reason: rejectionReason }),
  });
  notifyRefundsChanged();
  return result;
};
