## 2024-05-14 - [CRITICAL] Removed Developer Backdoors for Auth Bypass
**Vulnerability:** The application contained two development backdoors that allowed logging in without a password. One `login` method allowed bypassing authentication checks if `password` was omitted by directly querying the database for a user's details. Additionally, a `loginByRole` function allowed logging in as the first user with a matching role.
**Learning:** Development convenience functions that bypass standard security procedures (like full password validation via an IDP or authentication provider) often accidentally make their way into production code, creating critical, easily exploitable vulnerabilities.
**Prevention:** Never commit authentication bypasses, even for "development ease." Use robust mocking or dedicated test accounts to facilitate testing instead of altering core security mechanisms like `signInWithPassword`.
## 2026-05-16 - Secure Storage for Supabase Authentication
**Vulnerability:** Supabase auth tokens were stored in plain text using `@react-native-async-storage/async-storage`.
**Learning:** Default configurations for authentication clients on React Native sometimes fall back to easily accessible local storage wrappers which pose a risk if the device is compromised.
**Prevention:** Always use `expo-secure-store` or equivalent iOS Keychain/Android Keystore wrapper for storing sensitive session tokens in React Native apps.
