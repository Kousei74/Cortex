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
            const error = await response.json().catch(() => ({ detail: "Login failed" }));
            throw new Error(error.detail || "Login failed");
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
            const error = await response.json().catch(() => ({ detail: "Signup failed" }));
            throw new Error(error.detail || "Signup failed");
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

    uploadFile: (file, onProgress) => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);

            const xhr = new XMLHttpRequest();
            const token = localStorage.getItem("cortex_token");

            xhr.open("POST", `${API_BASE_URL}/ingest/upload`);
            if (token) {
                xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error("Invalid JSON response"));
                    }
                } else {
                    reject(new Error(xhr.statusText || "Upload failed"));
                }
            };

            xhr.onerror = () => reject(new Error("Network Error"));

            xhr.send(formData);
        });
    }
};
