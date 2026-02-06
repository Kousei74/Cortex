/**
 * Waits for a specified duration in ms.
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retries a fetch request with exponential backoff.
 * @param {string} url - API URL
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries
 * @param {number} backoff - Initial backoff in ms
 */
export const fetchWithRetry = async (url, options, retries = 3, backoff = 300) => {
    try {
        const response = await fetch(url, options);
        // Retry on 5xx errors or specific 408/429
        if (response.status >= 500 || response.status === 408 || response.status === 429) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response;
    } catch (err) {
        if (retries > 0) {
            console.warn(`Retrying fetch ${url}... (${retries} attempts left)`);
            await delay(backoff);
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
};

/**
 * Retries an XHR request (for simple cases).
 * Note: XHR is harder to retry cleanly because of event listeners, but for simple upload/blob logic:
 * We presume the caller handles the XHR setup inside the promise executor.
 * 
 * Better strategy for this project:
 * The `uploadWithRetry` logic will be implemented directly in api.js or here as a specialized function.
 */
export const uploadWithRetry = (url, headers, file, onProgress, onStatus, retries = 3, initialBackoff = 500) => {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url);

            // Set headers
            Object.keys(headers).forEach(key => {
                xhr.setRequestHeader(key, headers[key]);
            });

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress((event.loaded / event.total) * 100);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = xhr.responseText ? JSON.parse(xhr.responseText) : { success: true };
                        resolve(response);
                    } catch (e) {
                        // JSON error is likely application error, usually not worth retrying unless backend sent garbage 500 html
                        if (n > 0) retry(n, "Invalid JSON response");
                        else reject(new Error("Invalid JSON response"));
                    }
                } else if (xhr.status >= 500 || xhr.status === 429 || xhr.status === 408) {
                    // SERVER ERROR -> Retry
                    if (n > 0) retry(n, `Server Error ${xhr.status}`);
                    else reject(new Error(xhr.statusText || `Upload Exception ${xhr.status}`));
                } else {
                    // Client Error (4xx) -> Fail immediately
                    reject(new Error(xhr.statusText || "Upload failed"));
                }
            };

            xhr.onerror = () => {
                if (n > 0) retry(n, "Network Error");
                else reject(new Error("Network Error"));
            };

            xhr.send(file);
        };

        const retry = async (n, reason) => {
            const attemptsMade = retries - n + 1;
            // Exponential backoff: 500 * 2^(attempts)
            const baseDelay = initialBackoff * Math.pow(2, attemptsMade - 1);
            // Jitter: +/- 20% random
            const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
            const delayTime = Math.max(0, baseDelay + jitter);

            console.warn(`Upload failed (${reason}). Retrying in ${Math.round(delayTime)}ms... (${n} attempts left)`);

            if (onStatus) {
                onStatus(`Optimizing route... (${n} left)`);
            }

            await delay(delayTime);
            attempt(n - 1);
        };

        attempt(retries);
    });
};
