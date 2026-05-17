import { readFileSync, writeFileSync } from 'fs';

const path = 'stores/auth-store.ts';
let content = readFileSync(path, 'utf-8');

content = content.replace(/<<<<<<< HEAD\n\s*console\.error\('Login error:', e\);\n=======\n\s*\/\/ Error handled internally\n>>>>>>> 6bf6f89 \(fix\(security\): remove console logging of sensitive login errors\)/g, '// Error handled internally');
content = content.replace(/<<<<<<< HEAD\n\s*console\.error\('Logout error:', e\);\n=======\n\s*\/\/ Error handled internally\n>>>>>>> 6bf6f89 \(fix\(security\): remove console logging of sensitive login errors\)/g, '// Error handled internally');

writeFileSync(path, content);
