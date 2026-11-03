# React + Vite + статическая генерация

Задача требует весь snapshot, переиспользуемые компоненты и интерактивный
мобильный прототип, при этом backend исходного Bitrix не входит в снимок.
Выбран React/TypeScript/Vite с offline content pipeline и static prerender.

Каждый сохранённый URL получает HTML с контентом, title, canonical и JSON-LD.
После загрузки React оживляет интерфейс; browser summary ~379kB отделён от
полных HTML/составов каждой страницы. Инфраструктура ограничена build и localhost
preview, production интеграции отдельно.

Vite 8.3.1 поддерживает установленный Node 25.2.0; lockfile фиксирует зависимости.
Проверены [официальные требования Vite](https://vite.dev/guide/) и
[React renderToString](https://react.dev/reference/react-dom/server/renderToString).
Для source query пагинации используется manifest routing adapter вместо
надежды на одинаковый index.html для всех запросов.

Исходный snapshot assets/raw сохраняется как единственный воспроизводимый
источник; generated/public/dist исключены из git. Это сохраняет большие original
assets один раз и позволяет независимые content/byte проверки без сети.
