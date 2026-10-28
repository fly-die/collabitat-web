const DEFAULT_API_BASE_URL = "http://localhost:3000";

// CI passes an empty string when the API_URL variable is not set, which counts as unset.
const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl ? configuredApiBaseUrl : DEFAULT_API_BASE_URL;
