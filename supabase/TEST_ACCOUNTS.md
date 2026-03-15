# Test accounts (Pickleball Community)

Use these for local/testing. The app uses **phone + OTP** (Twilio) or **mock login**; these profiles are for display after you “log in.”

| Name          | Phone        | Email             | Location     |
|---------------|--------------|-------------------|--------------|
| Alex Rivers   | +1 512 555 1111 | alex@example.com   | Austin, TX   |
| Sarah Chen    | +1 512 555 2222 | sarah@example.com  | Round Rock, TX |
| Jordan Miller | +1 512 555 3333 | jordan@example.com | Austin, TX   |

- **Mock login:** If Twilio/sendCodeUrl is not set, use any phone (e.g. `+15125551111`) and OTP `123456` to “log in”; the app will store the phone and show the profile screen.
- **Supabase:** Run `supabase/schema.sql` in the SQL Editor to create tables and insert these profile rows (by id). The app does not yet map auth to `profiles.id`; it uses localStorage for name/avatar/phone.
