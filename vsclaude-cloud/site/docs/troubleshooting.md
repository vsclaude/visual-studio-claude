# Troubleshooting

## "Could not find `claude`"

Vey Studio runs your own Claude Code CLI, and looks for it the way your login
shell would. If it is installed somewhere your shell's `PATH` does not reach,
set `CLAUDE_BIN` to the full path of the `claude` executable before starting
the app. **Settings › Updates** shows which version was found.

## An account is not signed in

Open the account's menu under **Accounts**, at the foot of the chats column.
**Check again** asks the account again; **Sign in…** signs it in once more. Each account is its own Claude Code login, so signing out of
one does not touch the others.

## A chat stopped at the limit

That account is out of its five-hour (or weekly) window. Open the chat's
**Account** menu and pick another account. The next
message carries on with the whole conversation.

## A chat seems stuck

- A **shield** on its row means it is waiting for you: open it and answer the
  card above the composer.
- Otherwise press **Stop**, then send your message again.

## I paid for Pro and it has not turned on

Bank transfers are matched by the code in the transfer's content, so send it
exactly as shown on the payment page. Pro usually turns on within a minute or
two, on the computer you bought it on — click into the app's window to make
it ask again. On another computer, paste the licence key from your email. If
a transfer was short, or the
content was changed, it is not matched automatically — contact us with the
transfer's details and it will be sorted out by hand.

## Where is my data?

Your projects stay where they are. Vey Studio's own data — the list of projects,
your settings, chats and Claude account logins — is under
`~/.veystudio` on your machine. Every chat goes straight from your own
Claude accounts to Anthropic; Vey Studio's server is only involved in signing
in and buying Pro.
