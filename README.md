# 🐍 Змейка Deluxe

Аркадная змейка с кампанией, ареной против ботов, блицем, дуэлью и ежедневными
испытаниями. React + TypeScript + Vite, поле рисуется на Canvas 2D, звук
синтезируется на лету — ни одного аудиофайла в репозитории.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Режимы

| Режим             | Что это                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| **Приключение**   | 15 рукотворных уровней: порталы, ключи и замки, гонка с соперником       |
| **Арена**         | 2 минуты против 1–5 ботов трёх характеров; съел соперника — забрал очки  |
| **Блиц**          | 60 секунд, поле без границ, фруктовый ливень                             |
| **Миксер**        | Классика плюс любые из 8 модификаторов; сложнее правила — выше множитель |
| **Дуэль**         | Двое за одной клавиатурой, до 2/3/5 побед                                |
| **Испытание дня** | Одинаковые правила и поле для всех на весь день                          |

Прогресс, монеты, 14 скинов, 11 шляп, 7 арен, 26 достижений и ежедневные
задания хранятся в `localStorage`.

## Управление

**Клавиатура:** `WASD` или стрелки — поворот, `Пробел` — рывок, `P` / `Esc` — пауза.
В дуэли: игрок 1 — `WASD`, игрок 2 — стрелки.

**Телефон — четыре схемы**, переключаются в настройках и прямо в паузе:

| Схема      | Как работает                                               |
| ---------- | ---------------------------------------------------------- |
| **Свайпы** | Провёл пальцем в любой точке экрана. По умолчанию          |
| **Стик**   | Виртуальный джойстик появляется там, где коснулся палец    |
| **Крест**  | Классическая крестовина в углу экрана                      |
| **Тапы**   | Тап слева — поворот влево, справа — вправо. Для одной руки |

Настраиваются чувствительность свайпа, сторона хвата (для левшей) и сила вибрации.

### Почему поворот ощущается мгновенным

Змейка ходит по сетке, поэтому обычно поворот применяется только на следующем
шаге — до 165 мс ожидания на медленной скорости. Движок вместо этого **делает
шаг сразу**, если змейка только вошла в клетку, и возвращает «занятое» время
долгом к следующему шагу (`Engine.tryEarlyTurn`, `Snake.stepDebt`). Поворот
виден на следующем кадре, а средняя скорость не меняется — за серию поворотов
змейка оказывается впереди не больше чем на одну неполную клетку. Это свойство
закреплено тестом (`src/game/engine.test.ts`, «repays the borrowed time»).

Замеры на медленной скорости (шаг 165 мс): медиана задержки поворота
**102 мс → 21 мс**.

## Архитектура

```
src/
├── design/tokens.ts    палитра, высоты, радиусы, motion — источник правды
├── index.css           @theme: те же токены для Tailwind (сверяется тестом)
├── game/
│   ├── engine.ts       headless-симуляция: сетка, шаги, столкновения, бонусы
│   ├── renderer.ts     Canvas 2D: доска, змейки, частицы, эффекты
│   ├── ai.ts           боты: BFS к цели + оценка свободного места
│   ├── content.ts      скины, шляпы, арены, бонусы, модификаторы
│   ├── levels.ts       15 уровней как ASCII-карты
│   └── launch.ts       режимы и сборка GameConfig
├── store/profile.ts    прогресс в localStorage через useSyncExternalStore
├── ui/                 дизайн-кит, хуки вьюпорта и тач-управления
└── screens/            экраны приложения
```

Движок не знает о DOM: он принимает `dt` и отдаёт состояние плюс список
событий. Рендерер — «глупый» слой, который это состояние рисует. Поэтому движок
тестируется в окружении `node`, а не в браузере.

### Дизайн-система

Все цвета, тени, радиусы и длительности живут в `src/design/tokens.ts`. React
читает их через утилиты Tailwind (`bg-accent`, `text-fg-soft`, `shadow-e2`),
Canvas — импортом напрямую. `src/design/tokens.test.ts` падает, если блок
`@theme` в `index.css` разойдётся с TypeScript. Линтер запрещает сырые цвета
Tailwind (`bg-emerald-400` и подобные) в классах компонентов.

Тона несут смысл, а не украшают: `accent` — основное действие, `reward` —
монеты и рекорды, `danger` — смерть и сброс, `info` — второстепенные действия,
`special` — эпическая редкость и дуэль.

### Как добавить контент

- **скин или шляпу** — запись в `SKINS` / `HATS` (`src/game/content.ts`);
  у скина `color(i, len, t)` возвращает цвет сегмента;
- **арену** — запись в `THEMES` там же: цвета плиток, рамки и `chromeTint`,
  который подкрашивает меню под выбранную арену;
- **уровень** — ASCII-карта в `LEVELS` (`src/game/levels.ts`):
  `#` камень, `S` старт, `X` соперник, `A/a B/b C/c` пары порталов,
  `K` ключ, `L` замок, `G` монета.

## Разработка

```bash
npm run dev           # дев-сервер
npm run build         # typecheck + продакшен-сборка
npm run typecheck
npm run lint          # eslint --fix через npm run lint:fix
npm run format        # prettier
npm test              # vitest (83 теста)
npm run test:watch
```

Тесты покрывают очередь ввода и мгновенный поворот, столкновения и обёртку
поля, детерминизм ежедневного испытания, пороги звёзд, начисление наград,
миграцию профиля v1 → v2 и отрисовку кадра на всех семи аренах.

CI (`.github/workflows/ci.yml`) прогоняет формат, линтер, типы и тесты на каждый
push и pull request; деплой на GitHub Pages запускается только после них.

## Ресурсы

- 3D-иконки — [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT)
- Звук — [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT)
- Шрифты — Unbounded и Rubik, Google Fonts (OFL)

---

<details>
<summary>English</summary>

**Snake Deluxe** — an arcade snake game with a 15-level campaign, a bot arena,
a 60-second blitz, local two-player duels and a daily seeded challenge. React +
TypeScript + Vite; the board is Canvas 2D and all audio is synthesised at
runtime (no audio files).

The engine is headless and deterministic — it takes a `dt` and returns state
plus events — so it is unit-tested under `node`. Turning feels immediate
because a turn queued early in a cell is committed on the spot and the borrowed
time is repaid on the following step, leaving average speed unchanged (median
turn latency 102ms → 21ms at the slowest speed).

Design tokens live in `src/design/tokens.ts` and are mirrored into the Tailwind
`@theme` block, with a test that fails on drift. `npm install && npm run dev`.

</details>
