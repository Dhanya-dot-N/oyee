# Oyee

A voice accountability companion for your desktop that talks to you in **your own words**, like another you.

I freeze before starting tasks. Generic productivity apps nag in a voice that isn't mine, so I built one that answers with the replies I wrote for myself, shrinks the task to a 5-10 minute step, and nudges me at the time I chose. Built for the **Great Indian AI Internship Challenge** by Gnani AI.

![Home](home.png) ![Talk to Me](talk.png) ![Nudge Me](calendar.png)

## What it does

- **Know Me:** save the excuses you usually make ("I don't want to do DSA") along with 2-3 replies you wrote for each, plus a "why I'm doing this" note.
- **Talk to Me:** say or type what you're avoiding. oyeee replies as "Me", using your saved words, picks one 5-10 minute step, and suggests a method that fits (5-minute start, Pomodoro, ugliest first draft, and so on).
- **Nudge Me:** say "assignment due 10pm, write at 5pm" and it creates two reminders. You get a desktop notification at the time, and the app opens when you click it. A calendar view shows today, tomorrow and the days after.
- **Check-ins:** after you press Start, oyeee checks in at 10, 20 and 30 minutes, then every 30 minutes for up to 3 hours, spoken aloud, with Done / Still going / I'm stuck.
- **Voice in, voice out:** speech-to-text with Gnani **Prisma** and spoken replies with Gnani **Timbre**, in **English, Hindi and Kannada**. Replies come in one language only, chosen from a dropdown.
- **Deadline-aware:** if you say you have 2 hours left and half is done, the reply uses that and gives a concrete next step instead of telling you to rest.

## Designed to be kind

- Never guilts, shames or roasts.
- After 3 ignored nudges a reminder pauses itself instead of nagging.
- "Stop reminding me" works in English, Hindi and Kannada, and a global pause is in the tray menu.
- "I started" is reported by you. The app never claims to verify it.
- It's an accountability tool, not a therapist or a diagnostic tool.

## Built with

| Part | Technology |
| --- | --- |
| App | Electron (Windows), plain JavaScript |
| Speech to text | Gnani AI **Prisma** |
| Text to speech | Gnani AI **Timbre** v2.5 |
| Reply text and reminder parsing | Google Gemini API |
| Storage | Local JSON files on your computer |

## Run it

You need Node.js and a Windows machine.

```powershell
git clone <https://github.com/Dhanya-dot-N/oyee.git>
cd oyeee
npm install
```

Copy `.env.example` to `.env` and fill in your own keys:

```
GEMINI_API_KEY=
GEMINI_MODEL=
GNANI_API_KEY=
```

Optional: `GNANI_VOICE` to change the spoken voice, and `NUDGE_WAIT_MIN` to change how long to wait before a nudge counts as ignored (default 10 minutes).

```powershell
npm start
```

Shortcut: **Ctrl+Shift+Z** shows or hides the window. Closing the window keeps oyeee running in the tray. Use the tray menu to quit.

## Privacy and limits

- Your excuses, replies and reminders are stored only on your computer.
- What you type or say is sent to Gnani (speech) and Google Gemini (replies) to work. Use harmless example data when you demo it.
- Kannada replies are still being improved.
- Windows only for now. No mobile app and no wake word.

## Author

Dhanya, a second-year CS student in Bengaluru.
