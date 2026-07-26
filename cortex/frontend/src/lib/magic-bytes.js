/**
 * Validates file content against known magic byte signatures.
 * Prevents extension spoofing (e.g. .exe renamed to .csv).
 */

const SIGNATURES = {
    // Media
    '89504e47': 'image/png', // PNG
    'ffd8ff': 'image/jpeg', // JPEG
    '47494638': 'image/gif', // GIF
    '25504446': 'application/pdf', // PDF

    // Archives / Office
    '504b0304': ['application/zip', 'application/vnd.openxmlformats-officedocument.', 'application/x-zip-compressed'], // PK Zip (includes docx, xlsx, etc)

    // Text doesn't really have magic bytes, but we can check for non-binary content
    // or BOM. But for CSV/JSON, it's hard to validate via magic bytes definitively.
    // We will skip strict magic byte check for text/* unless we want to forbid binary control characters.
};

export const validateMagicBytes = async (file) => {
    // Skip small files or text files where magic bytes are unreliable
    // For CSV/JSON/TXT, usually we just assume they are text.
    // However, if someone renames malicious.exe to data.csv, we want to catch it.
    // EXEs usually start with '4D 5A' (MZ).

    // We can define "Blacklist" signatures instead for text files.

    const slice = file.slice(0, 4);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for MZ header (Executable)
    if (hex.startsWith('4d5a')) {
        console.warn('Blocked executable masquerading as ' + file.name);
        return false;
    }

    // If it claims to be an image/pdf, verify it matches
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        // Simple containment check
        const expected = Object.entries(SIGNATURES).find(([sig, type]) => {
            // Exact match or partial match on hex
            return hex.startsWith(sig);
        });

        if (!expected) {
            // For strict mode, we might reject. 
            // But browser mime-sniffing is usually okay. 
            // This is mostly to catch blatant mismatches.
            // If browser said 'image/png' but bytes don't match, reject.
            if (file.type === 'image/png' && !hex.startsWith('89504e47')) return false;
            if (file.type === 'image/jpeg' && !hex.startsWith('ffd8ff')) return false;
            if (file.type === 'application/pdf' && !hex.startsWith('25504446')) return false;
        }
    }

    return true;
};
