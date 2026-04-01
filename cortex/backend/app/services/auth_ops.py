from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from email.utils import formataddr
from typing import Any, Dict, Iterable, List, Optional

import requests

from app.core.config import settings
from app.core.database import service_role_supabase as supabase


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def normalize_name(full_name: str) -> str:
    return " ".join(str(full_name or "").strip().split())


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def build_invite_link(token: str) -> str:
    return f"{settings.INVITE_SIGNUP_URL}?token={token}"


def list_departments() -> List[Dict[str, Any]]:
    res = supabase.table("departments").select("dept_id,dept_name").order("dept_id").execute()
    return res.data or []


def get_department_ids() -> set[str]:
    return {row["dept_id"] for row in list_departments()}


def get_pending_requests() -> List[Dict[str, Any]]:
    res = (
        supabase.table("access_requests")
        .select("id,email,full_name,status,created_at")
        .eq("status", "pending")
        .order("created_at")
        .execute()
    )
    rows = res.data or []
    for row in rows:
        row["email"] = normalize_email(row.get("email", ""))
        row["full_name"] = normalize_name(row.get("full_name", ""))
    return rows


def _collect_ids(rows: Iterable[Dict[str, Any]], key: str = "id") -> List[str]:
    ids: List[str] = []
    for row in rows:
        value = row.get(key)
        if value:
            ids.append(value)
    return ids


def run_auth_cleanup() -> Dict[str, int]:
    now = utc_now()
    now_iso = now.isoformat()
    summary = {
        "expired_invites_deleted": 0,
        "approved_marked_expired": 0,
        "pending_deleted": 0,
        "rejected_deleted": 0,
        "expired_deleted": 0,
        "completed_deleted": 0,
    }
    marked_expired_request_ids = set()

    expired_invites = (
        supabase.table("invite_tokens")
        .select("id,request_id")
        .lt("expires_at", now_iso)
        .execute()
        .data
        or []
    )
    expired_invite_ids = _collect_ids(expired_invites)
    expired_request_ids = _collect_ids(expired_invites, "request_id")
    if expired_invite_ids:
        supabase.table("invite_tokens").delete().in_("id", expired_invite_ids).execute()
        summary["expired_invites_deleted"] += len(expired_invite_ids)
    if expired_request_ids:
        (
            supabase.table("access_requests")
            .update({"status": "expired", "reviewed_at": now_iso})
            .in_("id", expired_request_ids)
            .eq("status", "approved")
            .execute()
        )
        unique_request_ids = set(expired_request_ids)
        marked_expired_request_ids.update(unique_request_ids)
        summary["approved_marked_expired"] += len(unique_request_ids)

    approved_rows = (
        supabase.table("access_requests")
        .select("id")
        .eq("status", "approved")
        .execute()
        .data
        or []
    )
    approved_ids = _collect_ids(approved_rows)
    if approved_ids:
        live_invites = (
            supabase.table("invite_tokens")
            .select("request_id")
            .in_("request_id", approved_ids)
            .execute()
            .data
            or []
        )
        live_request_ids = {row["request_id"] for row in live_invites if row.get("request_id")}
        missing_ids = [
            req_id
            for req_id in approved_ids
            if req_id not in live_request_ids and req_id not in marked_expired_request_ids
        ]
        if missing_ids:
            (
                supabase.table("access_requests")
                .update({"status": "expired", "reviewed_at": now_iso})
                .in_("id", missing_ids)
                .eq("status", "approved")
                .execute()
            )
            summary["approved_marked_expired"] += len(missing_ids)

    def delete_old_requests(status_value: str, max_age_days: int, summary_key: str, timestamp_field: str) -> None:
        cutoff = (now - timedelta(days=max_age_days)).isoformat()
        stale_rows = (
            supabase.table("access_requests")
            .select("id")
            .eq("status", status_value)
            .lt(timestamp_field, cutoff)
            .execute()
            .data
            or []
        )
        stale_ids = _collect_ids(stale_rows)
        if stale_ids:
            supabase.table("access_requests").delete().in_("id", stale_ids).execute()
            summary[summary_key] += len(stale_ids)

    delete_old_requests("pending", settings.AUTH_PENDING_RETENTION_DAYS, "pending_deleted", "created_at")
    delete_old_requests("rejected", settings.AUTH_REJECTED_RETENTION_DAYS, "rejected_deleted", "reviewed_at")
    delete_old_requests("expired", settings.AUTH_EXPIRED_RETENTION_DAYS, "expired_deleted", "reviewed_at")

    completed_rows = (
        supabase.table("access_requests")
        .select("id")
        .eq("status", "completed")
        .execute()
        .data
        or []
    )
    completed_ids = _collect_ids(completed_rows)
    if completed_ids:
        supabase.table("access_requests").delete().in_("id", completed_ids).execute()
        summary["completed_deleted"] += len(completed_ids)

    return summary


def get_request_by_email(email: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_email(email)
    res = (
        supabase.table("access_requests")
        .select("*")
        .eq("email", normalized)
        .execute()
    )
    return res.data[0] if res.data else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_email(email)
    res = supabase.table("users").select("*").eq("email", normalized).execute()
    return res.data[0] if res.data else None


def get_invite_by_token(raw_token: str) -> Optional[Dict[str, Any]]:
    token_hash = hash_invite_token(raw_token)
    res = supabase.table("invite_tokens").select("*").eq("token_hash", token_hash).execute()
    invite = res.data[0] if res.data else None
    if not invite:
        return None

    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if utc_now() > expires_at:
        invite_id = invite.get("id")
        request_id = invite.get("request_id")
        if invite_id:
            supabase.table("invite_tokens").delete().eq("id", invite_id).execute()
        if request_id:
            (
                supabase.table("access_requests")
                .update({"status": "expired", "reviewed_at": utc_now().isoformat()})
                .eq("id", request_id)
                .eq("status", "approved")
                .execute()
            )
        return None

    return invite


def create_invite_record(request_row: Dict[str, Any], approved_dept_id: str) -> Dict[str, Any]:
    token = generate_invite_token()
    expires_at = (utc_now() + timedelta(minutes=settings.INVITE_TOKEN_EXPIRE_MINUTES)).isoformat()

    supabase.table("invite_tokens").delete().eq("request_id", request_row["id"]).execute()
    invite_data = {
        "request_id": request_row["id"],
        "email": normalize_email(request_row["email"]),
        "approved_dept_id": approved_dept_id,
        "token_hash": hash_invite_token(token),
        "expires_at": expires_at,
    }
    res = supabase.table("invite_tokens").insert(invite_data).execute()
    invite_row = res.data[0] if res.data else invite_data
    invite_row["raw_token"] = token
    return invite_row


def delete_invite_by_request_id(request_id: str) -> None:
    supabase.table("invite_tokens").delete().eq("request_id", request_id).execute()


def _require_resend_config() -> None:
    if not settings.RESEND_API_KEY or not settings.RESEND_FROM_EMAIL:
        raise RuntimeError("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.")


def send_invite_email(email: str, full_name: str, invite_token: str, approved_dept_id: str) -> Dict[str, Any]:
    _require_resend_config()
    invite_link = build_invite_link(invite_token)
    expires_minutes = settings.INVITE_TOKEN_EXPIRE_MINUTES
    recipient_name = normalize_name(full_name) or "there"
    sender = formataddr((settings.RESEND_FROM_NAME, settings.RESEND_FROM_EMAIL))

    text_body = (
        f"Hello {recipient_name},\n\n"
        "Your Cortex access request has been approved.\n"
        f"Department: {approved_dept_id}\n"
        f"Complete signup here: {invite_link}\n\n"
        f"This invite expires in {expires_minutes} minutes.\n"
        "If you did not expect this email, you can ignore it.\n"
    )
    html_body = (
        f"<p>Hello {recipient_name},</p>"
        "<p>Your Cortex access request has been approved.</p>"
        f"<p><strong>Department:</strong> {approved_dept_id}</p>"
        f"<p><a href=\"{invite_link}\">Complete your Cortex signup</a></p>"
        f"<p>This invite expires in {expires_minutes} minutes.</p>"
        "<p>If you did not expect this email, you can ignore it.</p>"
    )

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": sender,
            "to": [normalize_email(email)],
            "subject": "Your Cortex access invite",
            "text": text_body,
            "html": html_body,
        },
        timeout=15,
    )

    if response.status_code >= 400:
        detail = response.text.strip() or "Unknown Resend error"
        raise RuntimeError(f"Resend delivery failed: {detail}")

    return response.json()
