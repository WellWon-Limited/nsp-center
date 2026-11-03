# Дизайн-система NSP Center

Единственный визуальный источник — предоставленный файл
`assets/NSP App Prototype.html`. Система переносит его мятный canvas, тёмные
контрасты, мягкие цветовые пятна, полупрозрачные панели и плотную типографику
в responsive web. Цвета и размеры исходника сохранены; изменения для браузера
явно помечены `origin: extension` в `design/systems/nsp/tokens.json`.

Инвариант: приложение потребляет общий набор токенов и примитивов; извлечение
не меняет исходный HTML и не исполняет ни один bundled script. Потребители:
страницы приложения, каталог компонентов, стили новых разделов и проверки
происхождения ресурсов.

## Источник и воспроизводимость

SHA-256 исходного файла:
`ee22021e1996d17cf75b0dd4a9cbc6ce161aa83cb399711ff3d062dfda73e950`.
Рамка устройства в исходнике — 390 × 844 px, внутренний canvas — 370 × 824 px.
Внешний фон `#d7e2df` и чёрная рамка `#15171a` относятся к презентации телефона;
фон самого продукта — `#eaf3f1`.

```sh
node scripts/extract-prototype.mjs
node scripts/extract-prototype.mjs --check
```

Скрипт читает ровно один manifest/template/page-order JSON island, выполняет
Base64 decode и ограниченную gzip распаковку, проверяет WOFF2/PNG signatures
и сохраняет хеши. Три JavaScript-ресурса учитываются в provenance, но не
экспортируются в `public/`. Reference template и текст component лежат вне
публичного каталога; браузер приложения их не загружает. `--check` сравнивает
все 26 генерируемых файлов byte-for-byte, проверяет source colors, token aliases
и ссылки CSS-примитивов на токены. Результат повторного запуска детерминирован.

В прототипе обнаружены пять разделов: главная, каталог, консультант, здоровье,
профиль. Дополнительные состояния — карточка продукта, корзина, пустая корзина,
подтверждение заказа, тест из пяти вопросов и результат теста. Здоровье включает
график приёма и марафон на 21 день. Профиль содержит уровни PV, дисконтную карту,
заказы и переключатель напоминаний. Логика исходного прототипа локальная и
демонстрационная; наличие этих экранов не означает подключения магазина,
платежей или настоящего консультанта.

## Foundations

| Роль | Токен | Значение |
| --- | --- | --- |
| Canvas | `--color-bg` | `#eaf3f1` |
| Основной текст / основной CTA | `--color-ink` | `#1d3a36` |
| Ссылки | `--color-link` | `#23806a` |
| Add / send / completed icons | `--color-action` | `#2f9c80` |
| Mint / blue / sand | `--color-mint/blue/sand` | `#9fdcc6` / `#b9d4f5` / `#f3dcb8` |
| Вторичный текст | `--color-muted/subtle` | `#4f6d68` / `#5f7a75` |
| Glass / raised | `--color-glass/glass-raised` | white 45% / 60% |
| Border | `--color-glass-border` | white 80% |
| Notification marker | `--color-danger` | `#e2664f` |

Все 27 solid colors и 36 alpha colors исходника находятся в source inventory.
Семантические токены покрывают состояния приёма, уровни карты, overlays,
основные системы организма и их тёмные/светлые варианты. У систем здоровья
отдельные цвета: immune `#2f9c80`, cleanse `#8cbe5a`, nervous `#826ec8`, heart
`#dc6e6e`, digestion `#e6aa50`; color не заменяет текстовое название.

Текст: локальный Manrope 400–800, labels и суммы преимущественно 700/800.
IBM Plex Mono 500/600 используется для латинских названий и числовых кодов.
Из исходника извлечены 16 WOFF2 subsets с кириллицей и латиницей. Manrope —
variable font (в bytes диапазон `wght` 200–800, в системе опубликованы source
weights 400–800); одинаковые файлы по weights объединены. В runtime нет
Google Fonts запросов. Лицензии SIL OFL включены рядом с font assets; upstream:
[Manrope OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt)
и [IBM Plex Mono OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt).

Размеры текста: source scale 9/10/11/12/13/14/15/16/17/18/19/20/22/24/26/28/40 px.
Body 14 px / 1.45–1.55, section title 26 px / 1.15 / 800, tracking `-.02em`.
Spacing сохраняет observed scale от 1 до 32 px; базовый отступ панели — 18 px,
между элементами — 8/12/14/16/18 px. Радиусы: panel 26 px, control 14 px,
checkbox 9 px. Остальные source radii тоже доступны как `--radius-{n}`.
Glass blur 18/20/24/30 px, ambient blur 60/70 px. Тени navigation/toast/success
перенесены точно; тяжёлая device shadow остаётся reference-токеном.

Весь machine-readable набор — 187 токенов в `tokens.json`: colors, typography,
spacing, radii, shadows, blur, breakpoints, motion, focus, layers и controls.
`tokens.css` генерируется из этого файла; вручную его не меняют.

## API компонентов

Сначала импортируется `src/design-system.css`, затем CSS приложения. Примитивы
не зависят от React: подходят для semantic HTML и компонентов любого framework.

| Примитив | API | Состояния |
| --- | --- | --- |
| Button | `.btn`, `--primary`, `--action`, `--secondary`, `--ghost`, `--danger`, `--sm`, `--lg`, `--block` | default, hover, active, focus-visible, disabled, `aria-busy` |
| Icon button | `.icon-btn`, `--action`, `--dark`, `--sm` | hover, active, focus-visible, disabled |
| Panel | `.panel`, `--compact`, `--mint`, `--blue`, `--sand`, `--dark`, `--loyalty`, `--interactive` | hover, `data-state="selected"` или `aria-current="true"` |
| Pill | `.pill`, `--active`, `--mint`, `--blue`, `--sand`, `--small` | `aria-pressed`, `aria-selected`, hover, disabled |
| Field | `.field-group`, `.field-label`, `.field`, `.field-hint`, `.field-error` | placeholder, hover, focus, disabled, `aria-invalid` |
| Checkbox | `.check` | `aria-checked="true"`, `data-state="checked"`, disabled |
| Switch | `.switch` | `aria-checked`, disabled |
| Progress | `.progress` + child `span` / `.progress__fill`, либо native `progress` | value, empty, complete |
| Segmented control | `.segmented` + `button` | `aria-selected` или `aria-pressed`, disabled |
| Navigation | `.tabs`, `.tabs__item`, `.tabs__icon` | `aria-current="page"` или `aria-selected="true"` |
| Dialog | `.dialog-backdrop`, `.dialog`, `.dialog__header`, `.dialog__footer` | enter; full-width sheet на mobile |
| Toast | `.toast` | status / alert semantics задаёт consumer |
| Chat | `.chat-bubble`, `.chat-bubble--self` | incoming / outgoing |
| Product media | `.product-media`, `.product-media--set` | patterned placeholder / supplied PNG |
| Feedback | `.alert`, `--success`, `--danger`, `.empty-state` | info, success, error, empty |
| Utility | `.avatar`, `.divider`, `.sr-only` | decorative / accessible description |

`--variant` в таблице означает суффикс полного имени, например
`class="btn btn--primary btn--lg"`. Панель сама по себе не интерактивна:
действие оформляют настоящим `button` или ссылкой. Icon button получает
`aria-label`; decorative SVG — `aria-hidden="true"`.

```html
<button class="btn btn--primary">В корзину</button>
<button class="icon-btn icon-btn--action" aria-label="Добавить продукт">+</button>
<button class="pill" aria-pressed="true">Иммунитет</button>

<div class="field-group">
  <label class="field-label" for="search">Поиск в каталоге</label>
  <input class="field" id="search" type="search" aria-describedby="search-hint">
  <span class="field-hint" id="search-hint">Продукт, категория или цель</span>
</div>

<button class="switch" role="switch" aria-checked="true"
  aria-label="Напоминания о приёме"></button>
<progress class="progress" value="4" max="21" aria-label="Марафон: день 4 из 21"></progress>
```

Реальное управление dialog, focus trap, Escape/возврат фокуса, live regions,
roving tab index и значения форм реализует consumer. CSS описывает визуальные
состояния и не имитирует поведение. Invalid field связывается с текстом ошибки
через `aria-describedby`; ошибка читается текстом, а не только coral border.
`aria-disabled` у ссылки дополняется блокировкой действия в consumer; для
кнопок используется native `disabled`.

## Layout и адаптация для desktop

`.ds-stack` / `--sm` — вертикальный поток; `.ds-row` / `--between` — ряд;
`.ds-cluster` — переносимый ряд; `.ds-scroll-row` — горизонтальная лента с
доступной полосой прокрутки. `.ds-grid` + `--2/--3/--4` даёт 2/3/4 колонки на
desktop; до 960 px сетки 3/4 переходят в 2 колонки, до 640 px — в одну.
`.ds-grid--catalog` сохраняет source две колонки на phone, три на tablet и
четыре на desktop. Gap задаёт `--layout-gap` (18 px), в каталоге source 10 px.

Text utilities: `.ds-kicker`, `.ds-title`, `.ds-display`, `.ds-body`, `.ds-muted`,
`.ds-mono`. Display плавно растёт от source 28 до source 40 px; назначение 40 px
к крупному desktop заголовку является адаптацией (в исходнике 40 px — PV).

Desktop расширения перечислены отдельно, потому что source не задаёт web
breakpoints: 640/960/1280 px, ширина контента до 1440 px, centered dialog до
640 px, перенос grid/CTA и масштабирование title. CSS custom properties для
breakpoints справочные; media queries фиксируют те же границы. Основное
содержимое использует поток документа; phone frame и декоративный status bar
не становятся частью сайта.

Source action green `#2f9c80` с белым текстом имеет контраст 3.39:1. Для обычной
текстовой `.btn--action` взят уже существующий source link green `#23806a`
(4.81:1). Зелёные add/send icons сохраняют исходный `#2f9c80`. Source коралловый
цвет используется как marker/border; текст ошибки остаётся тёмным. Это
изменение назначения существующих цветов, без добавления новой палитры.

Keyboard focus добавлен явно: source ink ring 2 px, offset 3 px; в dark panel
ring mint-light. В прототипе input outline был скрыт, поэтому focus считается
web extension. Hover/active/disabled/busy и fixed pill radius для размеров
произвольной ширины также являются расширениями. Motion source: sheet 250 ms,
toast 200 ms, ease-out, сдвиг 24 px. Loading spinner — web extension;
`prefers-reduced-motion` отключает движение, forced-colors сохраняет boundaries.

## Обновление системы

1. Новое визуальное правило сначала оформляют токеном с происхождением и
   добавляют состояние в общий примитив, если его используют несколько экранов.
2. Запускают extraction и `--check`. Изменение supplied source hash требует
   отдельной проверки provenance; старый исходник не переписывают ради результата.
3. Проверяют типы и production build проекта, затем визуальную приёмку всех
   изменённых состояний в изолированном приложении через WellWon Canvas.

Текущая статическая проверка: `node scripts/extract-prototype.mjs --check`
верифицирует 26 файлов, 16 fonts, 1 image и неизменный source hash. Визуальная
приёмка относится к приложению, которое использует систему, и выполняется
через `sh .wellwon/canvas/cv`; наличие token files само по себе не является
доказательством корректной страницы.
