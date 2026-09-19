import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Without this a render error leaves a blank screen — the inline reporter in
 * index.html only messages the host, it shows the player nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Snake Deluxe crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 app-bg grid place-items-center p-6 text-center">
        <div className="glass-strong rounded-sheet p-7 max-w-sm">
          <img src={`${import.meta.env.BASE_URL}emoji/collision.png`} alt="" width={72} height={72} className="mx-auto" />
          <h1 className="font-display font-black text-2xl mt-3">Что-то сломалось</h1>
          <p className="text-fg-soft mt-2 text-sm">Прогресс сохранён. Перезагрузи страницу, чтобы продолжить.</p>
          <button onClick={() => window.location.reload()} className="btn3d font-display font-extrabold rounded-card px-6 py-3 mt-6 w-full">
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
