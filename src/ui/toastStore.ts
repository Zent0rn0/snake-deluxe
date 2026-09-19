import { audio } from '../audio/audio';
import type { AchievementDef } from '../store/profile';

export interface Toast {
  id: number;
  sprite: string;
  title: string;
  text: string;
  reward?: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeToasts(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const getToasts = () => toasts;

export function pushToast(t: Omit<Toast, 'id'>) {
  const toast = { ...t, id: nextId++ };
  toasts = [...toasts, toast];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== toast.id);
    emit();
  }, 3600);
}

export function toastAchievements(list: AchievementDef[]) {
  list.forEach((a, i) => {
    setTimeout(() => {
      audio.achievement();
      pushToast({ sprite: a.sprite, title: 'Достижение!', text: a.name, reward: a.reward });
    }, i * 700);
  });
}
