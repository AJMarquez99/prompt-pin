# prompt-pin

A Claude Code mod that keeps your latest prompt in view.

- **The band:** a 📌 line above the input shows the prompt you last sent, so you can see what
  Claude is working on, with the time you sent it and how long it has run (`14:02 · 42s…`).
  Once the turn ends it shows how long it took (`took 1m 23s`), or `stopped after` if you
  interrupted it. It dims while Claude is idle, and its **History** button opens the pane.
- **The pane:** `/prompts` opens a list of this session's prompts, newest first, with the time
  each was sent and how long each took. Run it again, or press Esc, to close it. It works
  mid-turn too.

Only your own prompts are recorded: ones typed at the terminal, sent over Remote Control, or from
an SDK host. Task notifications, messages from other sessions and prompts other plugins submit
are left out. The pane keeps the last 100.

## Install

```sh
claude plugin marketplace add AJMarquez99/prompt-pin
claude plugin install prompt-pin@prompt-pin
```

Start a new session to load it. Tested with Claude Code 2.1.300.

Without an SSH key for GitHub, add the marketplace by its HTTPS URL instead:

```sh
claude plugin marketplace add https://github.com/AJMarquez99/prompt-pin.git
```

To update to the latest version:

```sh
claude plugin marketplace update prompt-pin
claude plugin update prompt-pin@prompt-pin
```

To uninstall:

```sh
claude plugin uninstall prompt-pin@prompt-pin
claude plugin marketplace remove prompt-pin
```

## Behavior notes

- **Shares the band.** Other mods that draw above the input still show, under the pin.
- **Timing is per turn.** A prompt you type while Claude is still working is timed from when its
  own turn starts, not from when you sent it. A prompt Claude reads inside the running turn
  instead of a turn of its own shows only the time you sent it.
- **After `/resume` or `/branch`,** the history is rebuilt from the transcript. The transcript
  keeps no times, so those rows show none. `/clear` starts an empty history.
- **Hidden while a survey is up**, so the survey has the room.

## Develop

```sh
claude --plugin-dir .      # load the working copy in a session
claude plugin test         # run the tests
claude plugin validate .   # check the manifest and module
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code generates (and
`.gitignore` excludes) the first time it loads the mod. Run `claude --plugin-dir .` once before
type-checking with `tsc`.

The mod lives in `hooks/register.tsx`; text helpers are in `hooks/format.ts`.

## License

[MIT](LICENSE)
