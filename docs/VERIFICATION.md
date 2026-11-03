# Приёмка NSP Center

Проверка выполнена на production build в изолированном локальном сервере:
`WW_TEST=1 WW_TEST_ID=nsp-acceptance PORT=4173 npm run preview`.
Это frontend-проверка сохранённого snapshot; production-покупка не имитируется.

## Автоматические результаты

- `npm run check`: сборка/TypeScript проходят; 18 тестов, 17 PASS + один явно
  пропущенный HTTP-тест без NSP_TEST_URL; content gate — 9 checks, 0 issues.
- `NSP_TEST_URL=http://127.0.0.1:4173 npm test`: **18 PASS, 0 failed, 0 skipped**.
- `node scripts/extract-prototype.mjs --check`: 26 artifacts, 16 font subsets,
  один original image; source SHA-256 неизменён.
- HTTP-проверка всех 13 старых ссылок: 308 и правильный Location;
  неизвестный адрес — настоящий HTTP 404.
- `npm audit --omit=dev`: 0 vulnerabilities.

Сборка: 238 HTML-документов, 227 original route variants; 166 продуктов,
17 категорий, 8 статей и 16 информационных страниц; 757 local media files,
254 document links. Стартовый JS — 651.37kB (gzip135.85kB), browser summary379kB.
Полные описания и свойства встроены в HTML конкретной страницы.

Независимые content/build assertions подробно описаны в
[CONTENT-AUDIT.md](CONTENT-AUDIT.md).

## Все страницы в настоящем renderer

```sh
WW_TEST=1 WW_TEST_ID=nsp-acceptance \
NSP_TEST_URL=http://127.0.0.1:4173 node scripts/check-canvas.mjs
```

Команда использует исключительно `sh .wellwon/canvas/cv`: open, ожидание
`#root[data-hydrated="true"]`, accessibility query и diagnose.
Итог: **227/227 страниц** запустили React, имеют доступные заголовки и не
показали ошибок выполнения. Query-пагинация сохранила правильный URL.
Runtime receipt хранится в игнорируемой `.wellwon/canvas/nsp-runtime-audit.json`.
Это renderer/runtime evidence, а не утверждение о pixel-проверке каждого URL.
Chrome/Playwright и сторонний браузер для проверки не использовались.

## Проверенные сценарии через холст

- Поиск «Хлорофилл» оставил один соответствующий товар; добавление в корзину
  изменило счётчик. Увеличение количества до двух сохранилось после reload.
- Вкладка «Состав и применение» раскрыла исходные свойства;
  «Документы (2)» показала две локальные ссылки сертификатов.
- Добавление продукта в план, отметка приёма и reload сохранили отметку.
- Марафон переключает день и задачи в выбранном дне.
- Пять ответов анкеты довели сценарий до «Начните с полезной информации».
- Контактная форма подготовила ссылку «Открыть почту» с введённым вопросом;
  письмо не отправлялось и внешний почтовый клиент не открывался.
- Имя тестового профиля восстановилось в поле после reload; тестовое имя
  затем очищено. Никаких реальных персональных данных не использовалось.
- Живая витрина дизайн-системы показывает токены, typography, controls,
  формы, поверхности и состояния из общего runtime CSS.

## Визуальные кадры

Телефон — iPhone16Pro: 402×874, safe top62/bottom34. Большой экран —
MacBook Air13: 1470×919. Просмотрены реальные PNG, включая safe-зоны,
длинный product title и переносы article/FAQ. Pixel-проверка выполнена для
основных шаблонов; все166 отдельных товаров проверены автоматикой/renderer,
но не названы индивидуально pixel-принятыми.

- [Главная — телефон](verification/home-mobile.png)
- [Главная — большой экран](verification/home-desktop.png)
- [Каталог — телефон](verification/catalog-mobile.png)
- [Товар — телефон](verification/product-mobile.png)
- [Статья — телефон](verification/article-mobile.png)
- [FAQ — телефон](verification/faq-mobile.png)
- [Дизайн-система — телефон](verification/design-system-mobile.png)

Некоторые дополнительные desktop/health captures получили Canvas `no-frame`
из-за перекрытого/скрытого окна. Focus владельца не менялся. Это ограничивает
эти дополнительные PNG, но не успешные сохранённые кадры и runtime assertions.

## Границы результата

Оплата, authentication, серверная отправка заказов и живой чат не подключены.
Корзина/профиль/план/марафон сохраняются в этом браузере. Анкета не делает
медицинский диагноз. Цены/stock относятся к source snapshot.

`/photo/`, `/shares/` и исходный `/health-marafon/` были пустыми;
у марафона реализован отдельно отмеченный сценарий прототипа. Product review
texts отсутствуют в снимке. YouTube links/превью остаются внешними.

Человеческая приёмка владельца, реальный checkout и publication не заявляются.
