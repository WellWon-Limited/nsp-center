# Разработка NSP Center

Стек: React 19, TypeScript 5, Vite 8, Node.js 22.12+ и npm с package-lock.json.
Проверено на Node 25.2.0 / npm 11.6.2. Основа — статические HTML-документы с
React hydration; никаких backend hooks исходного магазина.

## Установка и запуск

```sh
npm ci
npm run content
npm run dev
```

Порт проекта — 5217, закреплён в реестре Factory (`cv servers ports mine`);
dev и preview используют его оба, поэтому одновременно не запускаются.

Dev: http://127.0.0.1:5217/. Для полной проверки direct URLs используйте
сборку и сервер с manifest-aware query routing:

```sh
npm run build
WW_TEST=1 WW_TEST_ID=nsp-acceptance npm run preview
```

Preview: http://127.0.0.1:5217/. `scripts/serve.mjs` связывает исходные
`?PAGEN_1=N` с отдельными HTML-документами. Обычный static host должен повторить
эти rewrite rules; файлы находятся в `catalog/<slug>/page/N/index.html`,
соответствия — `dist/prerender-manifest.json`. `/404/` — шаблон ошибки; неизвестный
адрес сервер действительно возвращает с HTTP 404. 13 старых product URLs
возвращают HTTP 308 на существующие карточки.
`/app-prototype/` отдаёт прототип приложения, адаптированный для фреймов
(`scripts/prototype-adapter.mjs`), `/app-prototype/original/` — исходный
`assets/NSP App Prototype.html` без изменений. В `dist/` ни тот, ни другой не
копируются ([описание прототипа](PROTOTYPE.md)).

## Быстрые проверки

```sh
npm run typecheck
node scripts/extract-prototype.mjs --check
node --test tests/content.test.mjs
```

## Полный quality gate

```sh
npm run check
```

Последовательно: offline extraction/import, browser summary, TypeScript,
production build, 238 SSR documents, content + rendered HTML tests, content
retention audit. Ожидание — exit 0. Без NSP_TEST_URL три HTTP-теста явно SKIP;
это не свидетельство проверки работающего сервера.

Для полного gate, включая все 227 HTTP-адресов, при запущенном изолированном
preview:

```sh
NSP_TEST_URL=http://127.0.0.1:5217 npm test
```

Ожидание — 25 tests passed, 0 failed, 0 skipped.

## Источники и импорт

- `scripts/extract-prototype.mjs` распаковывает только данные prototype bundle:
  шрифты, изображение, CSS tokens и provenance. Bundled JavaScript не исполняется.
- `scripts/import-content.mjs` читает JSON и raw HTML снимка, очищает markup,
  локализует изображения/документы, чинит старые product links. Сеть не нужна.
- `scripts/split-content.mjs` отделяет компактный browser summary от полных
  описаний. Детали текущей страницы встроены в её HTML безопасным JSON.
- `scripts/prerender.mjs` строит все маршруты; цена всегда внутри Product.offers.
- `scripts/check-content.mjs` независимо сверяет источник и импорт: поля,
  семантические тексты, пагинацию, ссылки и bytes/SHA256 локальных ресурсов.

Не редактируйте производные `src/generated/` и `public/media/` вручную.
Снимок можно обновить отдельно по `references/nsp-center.ru/README.md`; это
изменение цен/контента требует повторного полного gate.

## Визуальная приёмка

Только `sh .wellwon/canvas/cv`, без Chrome/Playwright. Запускайте приложение
с `WW_TEST=1 WW_TEST_ID=<id>`; Factory не запускайте самостоятельно.
Используйте query/snapshot, действия по ref, diagnose и shot для layout.
Проверяйте safe insets и телефон/большой экран. Все source страницы в renderer можно проверить повторяемо:

```sh
WW_TEST=1 WW_TEST_ID=nsp-acceptance NSP_TEST_URL=http://127.0.0.1:5217 npm run check:canvas
```

Фактические наблюдения записаны
в `docs/VERIFICATION.md`; проверки production API не заявляются.

## CI и публикация

`.github/workflows/check.yml` выполняет npm ci / npm run check на Node 24.
CI требует source snapshot в checkout; производные copies и dist игнорируются.
Build готовит локальный артефакт `dist/`; оплата и API в этот scope не входят.

## Dev-стенд

https://nsp-center.dev.codimax.ru — российский dev-сервер (Coolify WellWon,
AdminVPS). Каждое слияние в `main` пересобирает стенд сам: `Dockerfile` выполняет
`npm run build` и запускает `scripts/serve.mjs` с `HOST=0.0.0.0`, `PORT=4173`.
Выкладка занимает 5–10 минут: с этого сервера GitHub скачивается медленно.
Порядок выкладки: своя ветка -> pull request -> зелёные проверки `check` и
`docker-build` -> слить самому, одобрение не требуется. Красный запрос GitHub
слить не даст. Доступ к репозиторию и правила веток — `CONTRIBUTING.md`.
На стенде открыты и `/app-prototype/`, и `/app-prototype/original/`.
Доступ к Coolify и серверу для выкладки не нужен; статус и логи — у владельца
инфраструктуры (репозиторий wellwon-dev). Секреты и реальный пользовательский ввод в git не сохраняются.

## Цены: розничная и по дисконтной карте

Источник — прайс NSP в долларах (у.е. = $), выгруженный в
`references/prices/nsp-2026-11.json` (колонки `dist` — цена по дисконтной карте,
`retail` — розничная). Курс `rubPerUnit` в том же файле — курс склада, он меняется
(94 ₽ за $ с 2026-11-05, решение владельца): новое число в этом поле и пересборка
обновляют все цены. `scripts/pricing.mjs`
пересчитывает цены в рубли при импорте (`product.prices`); товары без строки в
прайсе сохраняют цену снимка и не имеют цены по карте. Исходная цена снимка
(`product.price`) не меняется. Проверка — `tests/build.test.mjs`.

## Страницы-темы

`/temy/<slug>/` отвечает на один поисковый вопрос («для чего нужен витамин D3») и
ведёт к главному товару и товарам, которые принимают вместе с ним. Каждая тема —
файл `src/theme-data/<slug>.json` (читает `scripts/themes.mjs`), вёрстка —
`src/theme-page.tsx`; на странице главного товара появляется блок «С чем
сочетают». Браузер получает только список тем, полный текст темы встроен в её
страницу, поэтому новые темы не утяжеляют сайт. Тексты опираются на базу лекций врачей (сама
база в репозиторий не кладётся) и не обещают лечения: `tests/themes.test.mjs`
не пропускает такие формулировки и проверяет ссылки, H1 и разметку FAQPage.

## Приложение на телефоне (PWA)

Сайт устанавливается на телефон и компьютер как приложение: `public/manifest.webmanifest`
(название NSP Center, иконки `public/icons/` — листик логотипа на тёмно-зелёном) и
сервис-воркер `dist/sw.js`, который пишет `scripts/pwa.mjs` из `scripts/sw-template.js`
в конце `npm run build`. Он заранее кладёт в кэш JS/CSS, иконки и страницы «Главная»,
«План», «Профиль», «Корзина», «Каталог», поэтому план приёма и марафон (они хранятся в
браузере) работают без сети; остальные страницы берутся из сети, а без неё — из кэша.
Окно «Установите приложение» (`src/pwa.tsx`) появляется при каждом входе на сайт и
обновлении страницы, пока приложение не установлено (не при переходах между страницами),
и затемняет экран; та же кнопка есть в профиле. На Android и в Chrome/Edge она сразу
запускает установку, на iPhone показывает шаги «Поделиться → На экран „Домой“». На
телефоне первую страницу визита закрывает экран загрузки с логотипом (`index.html`).
Напоминания о приёме приходят в колокольчик и, если разрешить, в шторку телефона, пока
приложение открыто или свёрнуто; напоминания при закрытом приложении требуют push-сервера.
Проверка — `tests/build.test.mjs`.

## Пробный аккаунт

Пока нет сервера аккаунтов, профиль хранится в браузере (`src/auth.tsx`). Чтобы посмотреть
личный кабинет, войдите как `demo@nsp-center.ru` с паролем `demo2026`: в этот браузер
кладётся готовый аккаунт «Анна Демо» с дисконтной картой (он заменяет локальный аккаунт,
если тот был). Гость видит на главной «Ваш план» и приглашение зарегистрироваться; по имени
сайт обращается только к вошедшему.
