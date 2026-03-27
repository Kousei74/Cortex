import { uploadWithRetry as requestUploadWithRetry } from './retry';
import demoDashboard from "./mock_data/dashboard_payload.json"
import demoIssuesActive from "./mock_data/issues_active.json"
import demoIssuesClosed from "./mock_data/issues_closed.json"
import demoGraphActive from "./mock_data/graph_active.json"
import demoGraphClosed from "./mock_data/graph_closed.json"



const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const isDemo = () => localStorage.getItem("cortex_demo_mode") === "true";

// Helper to get token
const getAuthHeaders = () => {
    const token = localStorage.getItem("cortex_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const triggerSessionLock = () => {
    localStorage.removeItem("cortex_token");
    window.dispatchEvent(new Event("cortex:session-expired"));
    if (window.location.pathname !== "/login") {
        window.location.href = "/login";
    }
};

const handleSessionFailure = async (response) => {
    const errorData = await response.json().catch(() => ({ detail: "" }));
    const detail = errorData.detail || "";
    const isSessionFailure = response.status === 401 || (
        response.status === 403 &&
        typeof detail === "string" &&
        (detail.toLowerCase().includes("session") || detail.toLowerCase().includes("invalid token"))
    );
    if (isSessionFailure) {
        if (typeof detail === "string" && !detail.includes("Slack error")) {
            triggerSessionLock();
        }
    }
    return detail;
};

const getErrorDetail = async (response, fallbackMessage) => {
    const errorData = await response.json().catch(() => ({ detail: fallbackMessage }));
    let detail = errorData.detail || fallbackMessage;
    if (typeof detail === "object") {
        detail = JSON.stringify(detail);
    }
    return detail;
};

const throwApiError = async (response, fallbackMessage) => {
    if (response.ok) {
        return;
    }

    const sessionDetail = await handleSessionFailure(response.clone());
    const detail = sessionDetail || await getErrorDetail(response, fallbackMessage);
    throw new Error(detail || fallbackMessage);
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

    requestAccess: async (fullName, email) => {
        if (isDemo()) {
            return { message: "Demo mode request received" };
        }
        const response = await fetch(`${API_BASE_URL}/auth/request-access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ full_name: fullName, email }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Request failed" }));
            let errorMessage = errorData.detail || "Request failed";
            if (typeof errorMessage === 'object') {
                errorMessage = JSON.stringify(errorMessage);
            }
            throw new Error(errorMessage);
        }
        return response.json();
    },

    verifyInvite: async (token) => {
        if (isDemo()) {
            return { email: "demo@cortex.local", dept_id: "demo-dept" };
        }
        const response = await fetch(`${API_BASE_URL}/auth/invite/verify?token=${encodeURIComponent(token)}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Invalid token" }));
            let errorMessage = errorData.detail || "Invalid token";
            throw new Error(errorMessage);
        }
        return response.json();
    },

    completeInvite: async (token, fullName, password) => {
        if (isDemo()) {
            return { message: "Demo account created" };
        }
        const response = await fetch(`${API_BASE_URL}/auth/invite/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, full_name: fullName, password }),
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
            await throwApiError(response, "Unauthorized");
        }
        return response.json();
    },

    updateProfile: async (fullName, deptId) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                full_name: fullName,
                dept_id: deptId
            }),
        });

        if (!response.ok) {
            await throwApiError(response, "Profile update failed");
        }
        return response.json();
    },

    uploadFile: async (file, onProgress, onStatus) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
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
                await throwApiError(metaResponse, "Metadata registration failed");
            }

            const metaData = await metaResponse.json();
            const uploadUrl = `${API_BASE_URL}${metaData.upload_url}`;

            // Step 2: Upload Binary Blob (with Retry)
            const token = localStorage.getItem("cortex_token");
            const headers = token ? { "Authorization": `Bearer ${token}` } : {};

            // Use the utility function
            return await requestUploadWithRetry(uploadUrl, headers, file, onProgress, onStatus);

        } catch (error) {
            const detail = String(error?.message || "").toLowerCase();
            const isSessionFailure = error?.status === 401 || (
                error?.status === 403 &&
                (detail.includes("session") || detail.includes("invalid token"))
            );
            if (isSessionFailure) {
                triggerSessionLock();
            }
            throw error;
        }
    },

    createReportJob: async (fileIds, projectId = "default") => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
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
            await throwApiError(response, "Job Creation Failed");
        }
        return response.json();
    },

    getReportJob: async (jobId) => {
        if (isDemo()) return demoDashboard;
        const response = await fetch(`${API_BASE_URL}/reports/jobs/${jobId}`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const detail = await handleSessionFailure(response);
            throw new Error(detail || "Job Poll Failed");
        }
        return response.json();
    },

    createIssue: async (payload) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
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
            await throwApiError(response, "Issue submission failed");
        }
        return response.json();
    },

    getIssues: async (status = "open", limit = 50, deptId = "", empId = "", role = "") => {
        if (isDemo()) {
            const data = status === "closed" ? demoIssuesClosed : demoIssuesActive;
            console.log("[Demo] getIssues:", status, data);
            return data;
        }
        const params = new URLSearchParams({
            status,
            limit: limit.toString(),
            ...(deptId && { dept_id: deptId }),
            ...(empId && { emp_id: empId }),
            ...(role && { role: role })
        });
        const response = await fetch(`${API_BASE_URL}/service/issues?${params.toString()}`, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to fetch issues");
        }
        return response.json();
    },

    getIssueGraph: async (issueId) => {
        if (isDemo()) {
            const isAct = demoIssuesActive.some(iss => iss.issue_id === issueId);
            const data = isAct ? demoGraphActive : demoGraphClosed;
            console.log("[Demo] getIssueGraph:", issueId, data);
            return data;
        }
        const response = await fetch(`${API_BASE_URL}/service/issues/${issueId}/graph`, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to fetch issue graph");
        }
        return response.json();
    },

    getIssue: async (issueId) => {
        if (isDemo()) {
            const data = demoIssuesActive.find(iss => iss.issue_id === issueId) || 
                         demoIssuesClosed.find(iss => iss.issue_id === issueId) || {};
            console.log("[Demo] getIssue:", issueId, data);
            return data;
        }
        const response = await fetch(`${API_BASE_URL}/service/issues/${issueId}`, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to fetch issue details");
        }
        return response.json();
    },

    tagIssueNode: async (issueId, tag, options = {}, lastUpdatedAt = null) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/${issueId}/tag`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                tag,
                ...options,
                last_updated_at: lastUpdatedAt
            })
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to tag node");
        }
        return response.json();
    },

    connectNode: async (nodeId, connectedToId, empId) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/node/${nodeId}/connect`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ connected_to_id: connectedToId, emp_id: empId })
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to connect node.");
        }
        return response.json();
    },

    updateNodePosition: async (nodeId, x, y) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/node/${nodeId}/position`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ layout_x: x, layout_y: y })
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to save node position");
        }
        return response.json();
    },

    updateNodeInfo: async (nodeId, payload, lastUpdatedAt = null) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/node/${nodeId}/info`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                ...payload,
                last_updated_at: lastUpdatedAt
            })
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to update node info");
        }
        return response.json();
    },

    mergeBlueBranch: async (targetParentId, branchNodes, metadataSummary, empId, deptId, documentation = {}) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/merge`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                target_parent_id: targetParentId,
                branch_nodes: branchNodes,
                metadata_summary: metadataSummary,
                emp_id: empId,
                dept_id: deptId,
                ...documentation
            })
        });
        if (!response.ok) await throwApiError(response, "Failed to merge branch");
        return response.json();
    },

    deleteIssueNode: async (issueId) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/${issueId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to delete node");
        }
        return response.json();
    },

    closeIssue: async (issueId) => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/issues/${issueId}/close`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to close issue");
        }
        return response.json();
    },

    getSlackAuthorizeUrl: async () => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/slack/authorize`, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to start Slack connection");
        }
        return response.json();
    },

    getSlackStatus: async () => {
        if (isDemo()) return { is_connected: false };
        const response = await fetch(`${API_BASE_URL}/service/slack/status`, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to load Slack status");
        }
        return response.json();
    },

    disconnectSlack: async () => {
        if (isDemo()) throw new Error("Action not allowed in Demo.");
        const response = await fetch(`${API_BASE_URL}/service/slack/disconnect`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            await throwApiError(response, "Failed to disconnect Slack");
        }
        return response.json();
    },

    getSlackMessages: async (oldest = 0, limit = 10) => {
        if (isDemo()) return [];
        const params = new URLSearchParams({
            oldest: String(oldest),
            limit: String(limit)
        });
        const response = await fetch(`${API_BASE_URL}/service/slack/messages?${params.toString()}`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            await throwApiError(response, "Failed to fetch Slack messages");
        }
        return response.json();
    }
};

