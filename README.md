# ByChat Dev

A simple Electron desktop application.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm start
```

## Build for Production

Build for your current platform:

```bash
npm run build
```

Or target a specific platform:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

Built output will be in the `dist/` folder.

## Project Structure

| File          | Description                              |
| ------------- | ---------------------------------------- |
| `main.js`     | Electron main process (creates windows)  |
| `preload.js`  | Secure bridge between main and renderer  |
| `renderer.js` | Renderer process (UI logic)              |
| `index.html`  | App UI markup                            |
| `styles.css`  | App styles                               |

## License

MIT
