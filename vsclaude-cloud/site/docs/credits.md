# Credits

Credits let you chat without a Claude account of your own, or keep going when
every one of your accounts is out of its 5-hour window. There is no
subscription: you buy a pack once and it **never expires**.

Your own Claude accounts stay free. Credits are only spent by chats you put
on them.

## Signing in

Credits belong to a Google account, so you sign in once:

1. Click **Sign in with Google** — in the account menu, in **Settings ›
   Claude**, or on the message that appears when a chat needs credits.
2. Your browser opens. Sign in with Google there.
3. Come back to the app. You stay signed in, even after a restart.

## Buying credits

Click **Buy credits** in the account menu, pick a pack and a way to pay:

- **Bank transfer (VietQR)** — scan the QR code in your banking app.
- **Card** — any international card.

| You pay   | You get in credits | Notes              |
| --------- | ------------------ | ------------------ |
| 20.000 ₫  | $0.667             | Bank transfer only |
| 50.000 ₫  | $1.67              |                    |
| 100.000 ₫ | $3.67              | +10% bonus         |
| 200.000 ₫ | $8.00              | +20% bonus         |

Credits arrive as soon as the payment does, and the app tells you when they
land.

## Chatting on credits

Open the chat's **Account** menu and pick **Pay with credits**. Chats on
credits are answered by **DeepSeek**, not Claude — Claude Code still runs the
chat, the model behind it is DeepSeek's. A new chat starts on **DeepSeek
Flash**, the cheaper one; pick **DeepSeek V4 Pro** in the model menu when you
need stronger reasoning.

DeepSeek cannot read PDF files, so a chat on credits that is asked to read one
will fail on it.

## What a reply costs

Credits are written in dollars of DeepSeek's own list price, and each model is
charged at its own rate — V4 Pro costs about four times what Flash does. Every
reply on credits ends with what it took off your balance, so you never have to
guess.

As a rough guide, one call to Flash with a mostly cached prompt is about
$0.002, and a Claude Code message makes a few of them. V4 Pro is about $0.006
a call.

::: tip
Long conversations cost more per message, because the whole conversation is
sent each time. On credits, a chat is compacted automatically before it grows
past 100K tokens.
:::

## Where your requests go

On credits, requests go through Vey Studio's server to DeepSeek, which is how
they are charged — so what you send in a chat on credits, including your code,
is processed on DeepSeek's servers. Your sign-in is never passed on. On your
own Claude accounts, requests go straight from the app to Anthropic — the
server is not involved.
