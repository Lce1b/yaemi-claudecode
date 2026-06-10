// Auto-review live test
const { runReview, getGitDiff, getChangedFilesFromDiff, codegraphAvailable } = require('../lib/auto-review');
const path = require('path');

// Point to yae-miko project for testing
const targetDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop', 'yae miko');

console.log('Target:', targetDir);
console.log('CodeGraph:', codegraphAvailable());

const { execFileSync } = require('child_process');

// Get git info from yae-miko
try {
  const diff = execFileSync('git', ['-C', targetDir, 'diff'], { encoding: 'utf8', timeout: 10000 });
  const staged = execFileSync('git', ['-C', targetDir, 'diff', '--staged'], { encoding: 'utf8', timeout: 10000 });
  const status = execFileSync('git', ['-C', targetDir, 'status', '--short'], { encoding: 'utf8', timeout: 10000 });

  console.log('Git status:');
  console.log(status || '(clean)');

  const fullDiff = (staged + diff).trim();
  console.log('Diff:', fullDiff.length, 'chars');

  if (!fullDiff) {
    console.log('No changes to review. Make some edits first.');
    process.exit(0);
  }

  console.log('\nRunning review...\n');

  runReview(null).then(result => {
    if (result) {
      console.log('=== AUTO REVIEW RESULT ===');
      console.log(result);
      console.log('=== END ===');
    } else {
      console.log('(no result — check YAEMI_REVIEW_API_KEY)');
    }
  }).catch(e => console.error('Error:', e.message));

} catch (e) {
  console.error('Error:', e.message);
}
