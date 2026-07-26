from app.core.security import get_password_hash
from app.core.database import service_role_supabase

def run():
    hashed = get_password_hash('password123')
    res = service_role_supabase.table('users').select('id, email').execute()
    count = 0
    for u in res.data:
        service_role_supabase.table('users').update({'hashed_password': hashed}).eq('id', u['id']).execute()
        print(f"Updated {u['email']}")
        count += 1
    print(f"Done resetting {count} passwords to password123.")

if __name__ == "__main__":
    run()
