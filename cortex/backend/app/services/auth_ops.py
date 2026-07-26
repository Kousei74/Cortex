from __future__ import annotations

import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, Iterable, List, Optional
import ssl

from app.core.config import settings
from app.core.database import service_role_supabase as supabase
from app.core.observability import get_logger, instrument_module_functions, log_step

logger = get_logger(__name__)


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
    log_step(logger, "auth_ops.cleanup.begin")
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

    log_step(logger, "auth_ops.cleanup.complete", **summary)
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
    log_step(logger, "auth_ops.invite.lookup.begin")
    token_hash = hash_invite_token(raw_token)
    res = supabase.table("invite_tokens").select("*").eq("token_hash", token_hash).execute()
    invite = res.data[0] if res.data else None
    if not invite:
        log_step(logger, "auth_ops.invite.lookup.miss")
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
        log_step(logger, "auth_ops.invite.lookup.expired", invite_id=invite_id, request_id=request_id)
        return None

    log_step(logger, "auth_ops.invite.lookup.hit", invite_id=invite.get("id"), request_id=invite.get("request_id"))
    return invite


def has_active_invite(request_id: str) -> bool:
    if not request_id:
        return False
    res = (
        supabase.table("invite_tokens")
        .select("id,expires_at")
        .eq("request_id", request_id)
        .execute()
    )
    if not res.data:
        return False
    invite = res.data[0]
    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    return utc_now() < expires_at


def create_invite_record(request_row: Dict[str, Any], approved_dept_id: str) -> Dict[str, Any]:
    log_step(
        logger,
        "auth_ops.invite.create.begin",
        request_id=request_row.get("id"),
        email=request_row.get("email"),
        approved_dept_id=approved_dept_id,
    )
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
    log_step(logger, "auth_ops.invite.create.success", request_id=request_row.get("id"), invite_id=invite_row.get("id"))
    return invite_row


def delete_invite_by_request_id(request_id: str) -> None:
    supabase.table("invite_tokens").delete().eq("request_id", request_id).execute()


def _require_smtp_config() -> None:
    required = {
        "SMTP_HOST": settings.SMTP_HOST,
        "SMTP_PORT": settings.SMTP_PORT,
        "SMTP_USERNAME": settings.SMTP_USERNAME,
        "SMTP_PASSWORD": settings.SMTP_PASSWORD,
        "SMTP_FROM_EMAIL": settings.SMTP_FROM_EMAIL,
    }
    missing = [key for key, value in required.items() if value in ("", None)]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"SMTP is not configured. Missing: {joined}.")


def _build_invite_email(full_name: str, invite_link: str, approved_dept_id: str, expires_minutes: int) -> tuple[str, str, str]:
    recipient_name = normalize_name(full_name) or "there"
    subject = "Your Cortex access invite"
    text_body = (
        f"Hello {recipient_name},\n\n"
        "Thank you for choosing Cortex.\n"
        "Your access request has been approved.\n"
        f"Department: {approved_dept_id}\n\n"
        f"Complete your sign-up here: {invite_link}\n\n"
        f"This invite is one-time use and expires in {expires_minutes} minutes.\n"
        "If you did not expect this email, you can ignore it.\n"
    )
    html_body = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="width=device-width" name="viewport" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta content="IE=edge" http-equiv="X-UA-Compatible" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection" />
  </head>
  <body style="background-color:#57575700;padding-top:0;padding-bottom:0;padding-right:0;padding-left:0">
    <table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center">
      <tbody>
        <tr>
          <td style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;font-size:1em;min-height:100%;line-height:155%;background-color:#57575700;padding-top:5px;padding-right:5px;padding-bottom:5px;padding-left:5px">
            <table align="left" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;align:left;width:100%;color:#000000;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;border-radius:0px;line-height:155%">
              <tbody>
                <tr style="width:100%">
                  <td>
                    <h3 style="margin:0;padding:0;font-size:20px;line-height:1.08em;padding-top:0.389em;font-weight:600;text-align:center">
                      Thank you for choosing Cortex
                    </h3>
                    <p style="margin:0;padding:0;font-size:1em;padding-top:0.5em;padding-bottom:0.5em;text-align:center">
                      Hello {recipient_name},<br />
                      Complete your sign-up process and get started<br />
                    </p>
                    <p style="margin:0;padding:0;font-size:14px;padding-bottom:0.5em;text-align:center">
                      Department: <strong>{approved_dept_id}</strong><br />
                      This invite is one-time use and expires in {expires_minutes} minutes.
                    </p>
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody style="width:100%">
                        <tr style="width:100%">
                          <td align="center" data-id="__react-email-column">
                            <a
                              class="button"
                              href="{invite_link}"
                              style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;margin:0;padding:0;background-color:#2398ff;color:#ffffff;border-radius:6px;padding-top:7px;padding-right:8px;padding-bottom:7px;padding-left:10px;font-size:22px;letter-spacing:1px;font-weight:600"
                              target="_blank"
                              ><span><!--[if mso]><i style="mso-font-width:500%;mso-text-raise:10.5" hidden>&#8202;</i><![endif]--></span
                              ><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:5.25px"
                                >Sign Up</span
                              ><span><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;&#8203;</i><![endif]--></span
                            ></a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p style="margin:0;padding:0;font-size:16px;padding-top:0.75em;padding-bottom:0.25em;text-align:center">
                      Great to have you onboard!
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>"""
    return subject, text_body, html_body


def send_invite_email(email: str, full_name: str, invite_token: str, approved_dept_id: str) -> Dict[str, Any]:
    norm_email = normalize_email(email)
    log_step(logger, "auth_ops.mail.send.begin", email=norm_email, approved_dept_id=approved_dept_id)
    invite_link = build_invite_link(invite_token)
    expires_minutes = settings.INVITE_TOKEN_EXPIRE_MINUTES
    subject, text_body, html_body = _build_invite_email(full_name, invite_link, approved_dept_id, expires_minutes)

    try:
        _require_smtp_config()
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
        message["To"] = norm_email
        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")

        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, int(settings.SMTP_PORT), timeout=20) as smtp:
            smtp.ehlo()
            log_step(logger, "auth_ops.mail.smtp.connected", host=settings.SMTP_HOST, port=settings.SMTP_PORT)
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            log_step(logger, "auth_ops.mail.smtp.authenticated", username=settings.SMTP_USERNAME)
            smtp.send_message(message)

        log_step(logger, "auth_ops.mail.send.success", email=norm_email)
        return {"status": "sent", "to": norm_email}
    except Exception as exc:
        # Fallback 4A: Log invite link to console and file when SMTP is unavailable or fails
        fallback_msg = f"[INVITE FALLBACK LINK] Email: {norm_email} | Dept: {approved_dept_id} | Link: {invite_link}"
        logger.warning(fallback_msg)
        print(f"\n{fallback_msg}\n")
        try:
            with open("invites_fallback.log", "a", encoding="utf-8") as f:
                f.write(f"{utc_now().isoformat()} - {fallback_msg}\n")
        except Exception:
            pass
        log_step(logger, "auth_ops.mail.send.fallback", email=norm_email, error=str(exc))
        return {"status": "fallback_logged", "to": norm_email, "invite_link": invite_link}


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions"})
