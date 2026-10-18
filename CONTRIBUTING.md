# Contributing to MacSweeper

Thank you for taking the time to contribute. MacSweeper is a macOS-only application and all contributions should target macOS 13 Ventura or later.

---

## Before You Start

- Check [open issues](../../issues) to avoid duplicating work.
- For significant changes, open an issue first to discuss the approach.
- MacSweeper is macOS-only. Do not add code paths or abstractions for other operating systems.

---

## Development Setup

```bash
git clone https://github.com/deenuy/macsweeper.git
cd macsweeper
npm install
npm run dev
```

Requires Node.js 20+ and npm 10+. Use `.nvmrc` to pin the version:

```bash
nvm use
```

---

## Pull Request Guidelines

1. **Branch from `main`.** Name your branch `feat/short-description` or `fix/short-description`.
2. **One concern per PR.** Keep changes focused; split unrelated work into separate PRs.
3. **Run type checking before submitting.**
   ```bash
   npm run typecheck
   ```
4. **No new external dependencies** without prior discussion in an issue.
5. **macOS only.** Do not introduce platform-conditional code for Linux or Windows.
6. **No hardcoded credentials.** Any feature requiring credentials must read them from environment variables or user-supplied files. See the Gmail integration in `src/main/gmail.ts` for the pattern.
7. **Safety first.** All file removal must go through `shell.trashItem()` (see `src/main/cleaner.ts`). Never use `fs.unlink` or `rm` directly.

---

## Code Style

- TypeScript strict mode is enabled. Fix type errors; do not use `any` or `@ts-ignore` unless unavoidable and documented.
- No UI libraries -- the project uses custom CSS with macOS vibrancy.
- Comments only where the *why* is non-obvious. Do not comment what the code does.
- No em dashes in user-facing strings.

---

## Reporting Security Issues

Do not open a public issue for security vulnerabilities. Email the maintainers privately at the address listed in `package.json`. We will respond within 72 hours and coordinate a fix before public disclosure.

---

## License

By contributing you agree that your changes will be released under the [MIT License](LICENSE).
