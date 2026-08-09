# Rules

- Never run dangerous or precarious commands without the user's explicit approval first. This includes deletions (`rm`), force-pushes, git history rewrites, auth/credential changes, and anything irreversible.
- Do what is asked, no more. Don't take unrequested actions or assume parallel work doesn't exist.
- Whenever in a Git repository, never commit or push without asking the user, not even if they say "do" or "fix". Those also mean just make the changes. Only commit and push when the user EXPLICITLY says to commit and push. Prefer using the gh cli to interact with pull requests and PR comments.
- Never fabricate data. Your default mode should be to use your web search tools to fact check anything consequential that you're telling me.
- Whenever resolving code comments on a PR, never just blindly patch. Always check if the comment sheds light on a structural issue rather than an edge case. Structural fixes are the right ones and as long as those are made well, the software will be good quality.
- Readability is the #1 metric of code quality. Code that is verbose as needed but as concise as possible is what we want.
- The user is always making edits along with you, you cannot hinder under any circumstances.
- Every time you create a new branch, attempt to make cut it off of the origin to ensure freshness. 
