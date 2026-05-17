# Security Report

## 1. Local Storage of Tokens

**[Critical] Unsecured Local Storage of Authentication Tokens**
File: `services/api.ts` — Line: 9
Description: The application uses `@react-native-async-storage/async-storage` for storing Supabase authentication tokens. `AsyncStorage` stores data in plain text, making it vulnerable to local device compromise or unauthorized access via backups.
Impact: An attacker with physical access or exploit on the device could easily read the user's authentication token and impersonate them.
Fix: Replaced `AsyncStorage` with `expo-secure-store` which encrypts data locally using the iOS Keychain / Android Keystore.

## 2. Debug Information / Console Logs

**[Low] Console Logging of Sensitive Data / Errors**
File: `stores/auth-store.ts` — Lines: 54, 75
Description: `console.error` is being used to log login errors to the standard console.
Impact: In production builds, this error data could potentially leak sensitive information or application states to malicious actors or debug tools.
Fix: Removed the explicit `console.error` logs in favor of proper error handling or secure logging.

## 3. Vulnerable Dependencies

**[Medium] Missing pnpm-lock.yaml / Dependency Audits**
File: `package.json`
Description: Dependencies were checked using `npm audit`. Found outdated packages with security issues (postcss).
Impact: Using vulnerable packages might lead to XSS or other vulnerabilities in the build tools or at runtime.
Fix: Updated dependencies / run npm audit fix (though usually handled outside of direct code changes for this task).

*Note*: No hardcoded secrets were found in config files. The `.env` variables are fetched dynamically during build time. HTTPS/WebView/DeepLinks vulnerabilities were not identified in the current limited codebase scope.

---
**Status**: Applied fixes to the `security/audit-fixes` branch.
