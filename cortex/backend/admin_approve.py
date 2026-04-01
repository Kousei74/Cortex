import os
import sys
from datetime import datetime, timezone

# Add backend directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.database import service_role_supabase as supabase
from app.services.auth_ops import (
    create_invite_record,
    delete_invite_by_request_id,
    get_pending_requests,
    get_department_ids,
    list_departments,
    run_auth_cleanup,
    send_invite_email,
)


def print_cleanup_summary(summary):
    print("\n--- CLEANUP SUMMARY ---")
    print(f"Expired invites deleted: {summary['expired_invites_deleted']}")
    print(f"Approved requests marked expired: {summary['approved_marked_expired']}")
    print(f"Pending requests deleted: {summary['pending_deleted']}")
    print(f"Rejected requests deleted: {summary['rejected_deleted']}")
    print(f"Expired requests deleted: {summary['expired_deleted']}")
    print(f"Legacy completed requests deleted: {summary['completed_deleted']}")


def parse_selection(selection: str, max_value: int) -> list[int]:
    chosen = set()
    for part in [item.strip() for item in selection.split(",") if item.strip()]:
        if "-" in part:
            start_raw, end_raw = part.split("-", 1)
            start = int(start_raw)
            end = int(end_raw)
            if start > end:
                start, end = end, start
            for value in range(start, end + 1):
                if 1 <= value <= max_value:
                    chosen.add(value)
        else:
            value = int(part)
            if 1 <= value <= max_value:
                chosen.add(value)
    return sorted(chosen)


def filter_requests(rows, search_term):
    term = search_term.strip().lower()
    if not term:
        return rows
    return [
        row for row in rows
        if term in (row.get("full_name") or "").lower() or term in (row.get("email") or "").lower()
    ]


def prompt_default_department(valid_dept_ids):
    departments = list_departments()
    print("\nAvailable Departments:")
    for dept in departments:
        print(f"  {dept['dept_id']}: {dept['dept_name']}")

    while True:
        dept_id = input("\nDefault department for selected requests: ").strip().upper()
        if dept_id in valid_dept_ids:
            return dept_id
        print("Invalid department ID. Please choose one from the list above.")


def prompt_overrides(selected_rows, default_dept_id, valid_dept_ids):
    print("\nSelected Requests:")
    for index, row in enumerate(selected_rows, start=1):
        print(f"  [{index}] {row['full_name']} <{row['email']}> -> {default_dept_id}")

    raw = input(
        "\nOptional overrides in the format row:DEPT,row:DEPT (press Enter to keep the default for all): "
    ).strip()
    dept_map = {row["id"]: default_dept_id for row in selected_rows}
    if not raw:
        return dept_map

    for part in [item.strip() for item in raw.split(",") if item.strip()]:
        if ":" not in part:
            raise ValueError("Override format must be row:DEPT")
        row_raw, dept_raw = part.split(":", 1)
        row_index = int(row_raw)
        dept_id = dept_raw.strip().upper()
        if row_index < 1 or row_index > len(selected_rows):
            raise ValueError("Override row number is out of range")
        if dept_id not in valid_dept_ids:
            raise ValueError(f"Unknown department: {dept_id}")
        dept_map[selected_rows[row_index - 1]["id"]] = dept_id
    return dept_map


def apply_review_state(request_ids, status_value):
    if not request_ids:
        return
    payload = {
        "status": status_value,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    if settings.AUTH_ADMIN_EMP_ID:
        payload["reviewed_by"] = settings.AUTH_ADMIN_EMP_ID
    (
        supabase.table("access_requests")
        .update(payload)
        .in_("id", request_ids)
        .execute()
    )


def run_cleanup_mode():
    summary = run_auth_cleanup()
    print_cleanup_summary(summary)


def run_approval_mode():
    summary = run_auth_cleanup()
    print_cleanup_summary(summary)

    if not settings.RESEND_API_KEY or not settings.RESEND_FROM_EMAIL:
        print("\nResend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL before approving requests.")
        return

    valid_dept_ids = get_department_ids()
    if not valid_dept_ids:
        print("\nNo departments are configured. Approval cannot continue.")
        return

    page_size = max(1, settings.AUTH_APPROVAL_PAGE_SIZE)
    page = 0
    search_term = ""

    while True:
        pending_rows = get_pending_requests()
        filtered_rows = filter_requests(pending_rows, search_term)
        total = len(filtered_rows)

        if not total:
            if search_term:
                print(f"\nNo pending requests matched '{search_term}'.")
                search_term = ""
                page = 0
                continue
            print("\nNo pending access requests.")
            return

        max_page = max(0, (total - 1) // page_size)
        page = min(page, max_page)
        start = page * page_size
        end = start + page_size
        visible_rows = filtered_rows[start:end]

        print(f"\n--- PENDING REQUESTS (page {page + 1}/{max_page + 1}, total {total}) ---")
        if search_term:
            print(f"Search: '{search_term}'")
        for idx, row in enumerate(visible_rows, start=1):
            print(f"[{idx}] {row['full_name']} <{row['email']}> - requested {row['created_at']}")

        print("\nCommands: [a]pprove page, [n]ext, [p]rev, [s]earch, [r]eset search, [q]uit")
        command = input("Choose an action: ").strip().lower()

        if command == "q":
            return
        if command == "n":
            if page < max_page:
                page += 1
            continue
        if command == "p":
            if page > 0:
                page -= 1
            continue
        if command == "s":
            search_term = input("Search by name or email: ").strip().lower()
            page = 0
            continue
        if command == "r":
            search_term = ""
            page = 0
            continue
        if command != "a":
            print("Unknown command.")
            continue

        selection = input(
            "Select rows to approve from this page (examples: 1,3,5-7). Unselected rows on this page will be rejected: "
        ).strip()
        try:
            selected_indexes = parse_selection(selection, len(visible_rows))
        except ValueError:
            print("Selection format is invalid.")
            continue

        if not selected_indexes:
            confirm_reject_all = input(
                "No rows selected. Reject every request shown on this page? [y/N]: "
            ).strip().lower()
            if confirm_reject_all != "y":
                continue
            rejected_ids = [row["id"] for row in visible_rows]
            apply_review_state(rejected_ids, "rejected")
            print(f"Rejected {len(rejected_ids)} requests from the current page.")
            continue

        selected_rows = [visible_rows[index - 1] for index in selected_indexes]
        selected_ids = {row["id"] for row in selected_rows}
        unselected_rows = [row for row in visible_rows if row["id"] not in selected_ids]

        default_dept_id = prompt_default_department(valid_dept_ids)
        try:
            dept_map = prompt_overrides(selected_rows, default_dept_id, valid_dept_ids)
        except ValueError as exc:
            print(f"Invalid overrides: {exc}")
            continue

        print("\nApproval Preview:")
        for row in selected_rows:
            print(f"  APPROVE {row['full_name']} <{row['email']}> -> {dept_map[row['id']]}")
        for row in unselected_rows:
            print(f"  REJECT  {row['full_name']} <{row['email']}>")

        confirm = input("\nSend invites and apply these decisions? [y/N]: ").strip().lower()
        if confirm != "y":
            continue

        approved_ids = []
        failed_rows = []
        for row in selected_rows:
            try:
                invite_row = create_invite_record(row, dept_map[row["id"]])
                send_invite_email(
                    email=row["email"],
                    full_name=row["full_name"],
                    invite_token=invite_row["raw_token"],
                    approved_dept_id=dept_map[row["id"]],
                )
                apply_review_state([row["id"]], "approved")
                approved_ids.append(row["id"])
            except Exception as exc:
                delete_invite_by_request_id(row["id"])
                failed_rows.append((row, str(exc)))

        rejected_ids = [row["id"] for row in unselected_rows]
        if rejected_ids:
            apply_review_state(rejected_ids, "rejected")

        print("\n--- APPROVAL RESULT ---")
        print(f"Invites sent: {len(approved_ids)}")
        print(f"Auto-rejected on this page: {len(rejected_ids)}")
        print(f"Send failures left pending: {len(failed_rows)}")
        for row, error in failed_rows:
            print(f"  FAILED {row['email']}: {error}")


def main():
    while True:
        print("\n=== CORTEX AUTH ADMIN ===")
        print("[1] Approval")
        print("[2] Cleanup")
        print("[q] Quit")
        choice = input("Choose an option: ").strip().lower()

        if choice == "1":
            run_approval_mode()
        elif choice == "2":
            run_cleanup_mode()
        elif choice == "q":
            break
        else:
            print("Unknown option.")


if __name__ == "__main__":
    main()
