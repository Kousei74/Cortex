import { uploadWithRetry as requestUploadWithRetry } from './retry';

const API_BASE_URL = "http://localhost:8000";

// Helper to get token
const getAuthHeaders = () => {
    const token = localStorage.getItem("cortex_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
    // Auth Endpoints
    login: async (email, password) => {
        // OAuth2PasswordRequestForm expects form data, not JSON
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Login failed" }));
            let errorMessage = errorData.detail || "Login failed";
            if (typeof errorMessage === 'object') {
                errorMessage = JSON.stringify(errorMessage);
            }
            throw new Error(errorMessage);
        }
        return response.json();
    },

    signup: async (email, password, fullName) => {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name: fullName }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Signup failed" }));
            let errorMessage = errorData.detail || "Signup failed";
            if (typeof errorMessage === 'object') {
                errorMessage = JSON.stringify(errorMessage);
            }
            throw new Error(errorMessage);
        }
        return response.json();
    },

    getMe: async () => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
        });

        if (!response.ok) {
            throw new Error("Unauthorized");
        }
        return response.json();
    },

    uploadFile: async (file, onProgress, onStatus) => {
        try {
            // Step 1: Send Metadata
            const metaResponse = await fetch(`${API_BASE_URL}/ingest/meta`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    filename: file.name,
                    file_type: file.type,
                    file_size: file.size
                })
            });

            if (!metaResponse.ok) {
                throw new Error("Metadata registration failed");
            }

            const metaData = await metaResponse.json();
            const uploadUrl = `${API_BASE_URL}${metaData.upload_url}`;

            // Step 2: Upload Binary Blob (with Retry)
            const token = localStorage.getItem("cortex_token");
            const headers = token ? { "Authorization": `Bearer ${token}` } : {};

            // Use the utility function
            return await requestUploadWithRetry(uploadUrl, headers, file, onProgress, onStatus);

        } catch (error) {
            throw error;
        }
    },

    createReportJob: async (fileIds, projectId = "default") => {
        const response = await fetch(`${API_BASE_URL}/reports/jobs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                file_ids: fileIds,
                project_id: projectId
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: "Job Creation Failed" }));
            throw new Error(error.detail || "Job Creation Failed");
        }
        return response.json();
    },

    createIssue: async (payload) => {
        const isChild = payload.type === "existing";
        const url = isChild
            ? `${API_BASE_URL}/service/issues/child`
            : `${API_BASE_URL}/service/issues`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: "Issue submission failed" }));
            let msg = err.detail || "Issue submission failed";
            if (typeof msg === "object") msg = JSON.stringify(msg);
            throw new Error(msg);
        }
        return response.json();
    }
};

