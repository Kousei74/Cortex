from app.core.database import supabase
from app.core.security import verify_password

def check_user():
    email = "trialdev11@gmail.com"
    password = "password123"
    
    try:
        res = supabase.table("users").select("*").eq("email", email).execute()
        if not res.data:
            print(f"User {email} not found in database.")
            return
        
        user = res.data[0]
        print(f"User found: {user['email']}")
        print(f"Hashed password in DB: {user['hashed_password']}")
        
        is_correct = verify_password(password, user['hashed_password'])
        print(f"Password verification for '{password}': {is_correct}")
        
        if not user.get("is_approved"):
            print("User is NOT approved.")
        else:
            print("User is approved.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_user()
