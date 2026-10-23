# Troubleshooting

## "Could not find `claude`"

Vey Studio runs your own Claude Code CLI, and looks for it the way your login
shell would. If it is installed somewhere your shell's `PATH` does not reach,
set `CLAUDE_BIN` to the full path of the `claude` executable before starting
the app. **Settings › Updates** shows which version was found.

You do not need Claude Code at all to chat on [credits](/docs/credits).

## An account is not signed in

Open **Settings › Claude**. **Check** asks the account again; **Log in** signs
it in once more. Each account is its own Claude Code login, so signing out of
one does not touch the others.

## A chat stopped at the limit

That account is out of its five-hour (or weekly) window. Open the chat's
**Account** menu and pick another account, or **Pay with credits**. The next
message carries on with the whole conversation.

## A chat seems stuck

- A **shield** on its row means it is waiting for you: open it and answer the
  card above the composer.
- Otherwise press **Stop**, then send your message again.

## The credits I paid for have not arrived

Bank transfers are matched by the code in the transfer's content, so send it
exactly as shown on the payment page. Credits usually land within a minute or
two. If a transfer was short, or the content was changed, it is not added
automatically — contact us with the transfer's details and it will be sorted
out by hand.

## A chat on credits says the prompt is too long

On credits, a request is limited to 100K tokens. Vey Studio has Claude Code
compact the conversation before it gets there, so this should be rare; if it
happens, start a new chat or ask Claude to summarise first.

## Where is my data?

Your projects stay where they are. Vey Studio's own data — the list of projects,
your settings, chats and Claude account logins — is under `~/.veystudio` on your
machine. Requests from your own Claude accounts go straight to Anthropic; only
chats on credits go through Vey Studio's server.
