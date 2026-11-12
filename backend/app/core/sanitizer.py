"""Input sanitization, path traversal prevention, and LLM prompt injection guards."""

import html
import re
from pathlib import Path

# Permitted file upload extensions for knowledge base documents
ALLOWED_DOCUMENT_EXTENSIONS: set[str] = {".txt", ".md", ".pdf", ".csv"}

# Forbidden dangerous file extensions
DANGEROUS_EXTENSIONS: set[str] = {
    ".exe", ".bat", ".cmd", ".sh", ".bash", ".php", ".py", ".js", ".vbs",
    ".msi", ".dll", ".scr", ".com", ".pif", ".html", ".htm", ".svg", ".xhtml",
}

# Regex for stripping path traversal and dangerous characters from filenames
_PATH_TRAVERSAL_PATTERN = re.compile(r"(\.\./|\.\.\\|[\x00-\x1f\x7f])")

# Common prompt injection and adversarial delimiter patterns
_PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"override\s+system\s+(prompt|instructions)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+)?developer\s+mode", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+dan", re.IGNORECASE),
    re.compile(r"###\s*(system|instruction|human|assistant):?", re.IGNORECASE),
    re.compile(r"<\s*\|\s*(im_start|im_end|endoftext)\s*\|\s*>", re.IGNORECASE),
    re.compile(r"\[\s*inst\s*\]", re.IGNORECASE),
]


def sanitize_text(value: str, max_length: int | None = None) -> str:
    """Sanitize user text input by stripping control chars, escaping raw HTML, and applying max length."""
    if not value:
        return ""
    # Strip non-printable control characters (except newline, tab, carriage return)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
    # Escape raw HTML special characters to prevent stored XSS
    cleaned = html.escape(cleaned)
    if max_length and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned.strip()


def sanitize_filename(filename: str | None) -> str:
    """Sanitize an uploaded file name to eliminate directory traversal and shell metacharacters."""
    if not filename or not filename.strip():
        return "untitled.txt"

    # Extract base filename to strip any leading directory path (e.g., ../../etc/passwd -> passwd)
    base_name = Path(filename).name
    # Remove traversal sequences and control characters
    sanitized = _PATH_TRAVERSAL_PATTERN.sub("", base_name)
    # Strip any remaining backslashes or slashes
    sanitized = sanitized.replace("/", "_").replace("\\", "_")
    # Only allow safe filename characters: alphanumerics, hyphens, underscores, periods
    sanitized = re.sub(r"[^a-zA-Z0-9._\- ]", "_", sanitized)
    sanitized = sanitized.strip(". ")

    if not sanitized:
        return "untitled.txt"
    return sanitized


def validate_file_extension(filename: str) -> str:
    """Validate that the file has an approved document extension.

    Raises ValueError if extension is unsupported or hazardous.
    """
    ext = Path(filename).suffix.lower()
    if ext in DANGEROUS_EXTENSIONS:
        raise ValueError(f"Dangerous file extension '{ext}' is forbidden.")
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported formats: {allowed}"
        )
    return ext


def validate_file_content_signature(filename: str, sample_bytes: bytes) -> None:
    """Validate file content matches its extension and does not contain dangerous binary headers."""
    if not sample_bytes:
        raise ValueError("Uploaded file is empty.")

    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        if not sample_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF file header. File does not appear to be a valid PDF document.")
        return

    # Check for known executable/binary signatures disguised under text extensions (.txt, .md, .csv)
    # MZ = Windows PE / DOS executable
    # \x7fELF = Linux ELF binary
    # \xca\xfe\xba\xbe, \xcf\xfa\xed\xfe, \xce\xfa\xed\xfe = Mach-O / Java bytecode
    if (
        sample_bytes.startswith(b"MZ")
        or sample_bytes.startswith(b"\x7fELF")
        or sample_bytes.startswith(b"\xca\xfe\xba\xbe")
        or sample_bytes.startswith(b"\xcf\xfa\xed\xfe")
        or sample_bytes.startswith(b"\xce\xfa\xed\xfe")
    ):
        raise ValueError("Executable binary content detected. Upload rejected for security.")

    # Check for null bytes in plain text files (indicates raw binary or shellcode)
    if b"\x00" in sample_bytes[:4096]:
        raise ValueError("Binary or null bytes detected in plain text document.")


def guard_prompt_query(question: str, max_length: int = 2000) -> str:
    """Detect and neutralize prompt injection attempts and adversarial delimiters in retrieval queries."""
    if not question:
        return ""

    sanitized = question.strip()
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    # Neutralize dangerous delimiter tokens and jailbreak phrases
    for pattern in _PROMPT_INJECTION_PATTERNS:
        sanitized = pattern.sub("[filtered_adversarial_token]", sanitized)

    # Strip zero-width spaces / joiners used by attackers to evade keyword filters
    sanitized = re.sub(r"[\u200b-\u200d\uFEFF]", "", sanitized)

    return sanitized
