/**
 * Run this locally whenever you want to add or update a manager account:
 *
 *   node generate-manager-hash.js
 *
 * It will ask for a username and password, then print a line you paste
 * into the MANAGER_USERS array in server.js. The plaintext password is
 * never written anywhere — only the salt + hash get saved.
 */
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

(async () => {
  const username = (await ask('Username: ')).trim();
  const password = await ask('Password: ');
  rl.close();

  if (!username || !password) {
    console.log('Both a username and password are required.');
    process.exit(1);
  }
  if (password.length < 6) {
    console.log('Use a password with at least 6 characters.');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');

  console.log('\nPaste this line into the MANAGER_USERS array in server.js:\n');
  console.log(`  { username: '${username}', salt: '${salt}', hash: '${hash}' },`);
  console.log('\n(Then save server.js, commit, and restart/redeploy the server.)');
})();
