const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const file = name => fs.readFileSync(path.join(root, name), 'utf8');

const login = file('login.html');
const requestPage = file('forgot-password.html');
const resetPage = file('reset-password.html');
const requestScript = file('forgot-password.js');
const resetScript = file('reset-password.js');
const signup = file('signup.js');
const styles = file('style.css');

assert.match(login, /href="forgot-password\.html"/, 'Login has a password recovery link');
assert.match(requestPage, /<form id="forgotPasswordForm"/);
assert.match(requestPage, /autocomplete="email"/);
assert.match(requestPage, /<script src="forgot-password\.js\?v=/);
assert.match(resetPage, /<form id="resetPasswordForm"[^>]*hidden/);
assert.match(resetPage, /autocomplete="new-password"/g);
assert.match(resetPage, /id="resetPasswordComplete"[^>]*hidden/);
assert.match(resetPage, /<script src="reset-password\.js\?v=/);

assert.match(requestScript, /sb\.auth\.resetPasswordForEmail\(email,\s*\{ redirectTo \}\)/);
assert.match(requestScript, /new URL\('reset-password\.html', window\.location\.href\)/);
assert.match(requestScript, /If an account uses that email address/);
assert.doesNotMatch(requestScript, /No account exists for/);
assert.match(requestScript, /submitButton\.disabled = true/);
assert.match(resetScript, /event === 'PASSWORD_RECOVERY'/);
assert.match(resetScript, /hasRecoveryLink && data\.session\?\.access_token/);
assert.match(resetScript, /sb\.auth\.getUser\(\)/);
assert.match(resetScript, /sb\.auth\.updateUser\(\{ password \}\)/);
assert.match(resetScript, /password !== confirm/);
assert.match(resetScript, /sb\.auth\.signOut\(\)/);
assert.match(resetScript, /window\.history\.replaceState\(/);
assert.match(styles, /\.cmcAuthBody \.cmcAuthRecoveryRow/);
assert.match(signup, /complete your CMC profile/);
assert.doesNotMatch(signup, /complete your candidate profile/);

console.log('Password recovery UI, Supabase flow and CMC profile copy checks passed.');
