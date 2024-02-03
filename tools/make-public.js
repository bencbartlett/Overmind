import { simpleGit } from "simple-git";

const PUBLIC_PREFIX = 'public/';
const PUBLIC_BRANCH_POINT = "deobfuscated-base";

const git = simpleGit(undefined, {});

const branches = await git.branchLocal();
if (!branches.all.includes(PUBLIC_BRANCH_POINT)) {
	console.error(`Branchpoint missing, needed a branch named ${PUBLIC_BRANCH_POINT}`);
	process.exit(1);
}

const status = await git.status();
const current = status.current;
if (current.startsWith(PUBLIC_PREFIX)) {
	console.error(`Current branch ${current} already starts with ${PUBLIC_PREFIX}`);
	process.exit(1);
}

const publicBranch = PUBLIC_PREFIX + current;
if (branches.all.includes(publicBranch)) {
	console.log(`Deleting target branch ${publicBranch}…`);
	await git.deleteLocalBranch(publicBranch, true);
}

console.log(`Creating target branch ${publicBranch}…`);
await git.checkoutBranch(publicBranch, status.current);

console.log(`Filtering out non-obfuscated files…`);
const indexFilter = "\
git rm --cached --ignore-unmatch src/Overmind.ts src/assimilation/Assimilator.ts;\
";
try {
	await git.env("FILTER_BRANCH_SQUELCH_WARNING", "1").raw("filter-branch", "--prune-empty", "--index-filter", indexFilter, `${PUBLIC_BRANCH_POINT}..HEAD`);
} catch (err) {
	console.error(`Failed to rewrite branch history: ${err.message}`);
	await git.checkout(current)
		.deleteLocalBranch(publicBranch);
	process.exit(1);
}

console.log(`Branch ${current} rewritten as ${publicBranch}`);
console.log(`Don't forget to delete the filter-branch backup with "git update-ref -d refs/original/refs/heads/${publicBranch}"!`);
