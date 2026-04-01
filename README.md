# Anna's List

A visual task and time management app with a timeline interface.

## Features

- **Timeline View** - Visualize tasks across a vertical timeline
- **Drag & Drop** - Easily move and resize tasks by dragging
- **Time Logging** - Track time spent on tasks with automatic logging
- **Task Templates** - Create reusable task templates for common activities
- **Snap-to-Grid** - Tasks snap to configurable intervals (5min, 15min, 30min, 1hr)
- **Local Storage** - All data persisted locally in browser

## Tech Stack

- [React 19](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vite.dev/) - Build tool
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [@dnd-kit](https://dndkit.com/) - Drag and drop
- [date-fns](https://date-fns.org/) - Date utilities

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # UI components
│   ├── Modal/           # Task and time log modals
│   ├── Sidebar/         # Right sidebar panel
│   ├── Task/            # Task block component
│   ├── TemplatesPanel/  # Left panel with task templates
│   ├── Timeline/        # Main timeline view
│   └── Toolbar/         # Top toolbar
├── context/             # React context providers
├── store/               # Zustand state store
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── App.tsx              # Root component
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## License

MIT