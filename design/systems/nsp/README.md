# NSP Center · дизайн-система 1.0

Дизайн-система извлечена из предоставленного владельцем мобильного прототипа
`assets/NSP App Prototype.html` и адаптирована для responsive web.

Подключение: импорт `src/design-system.css` до CSS приложения. Он подключает
локальные шрифты и сгенерированные CSS-переменные. Значения редактируются в
`tokens.json`; CSS-примитивы — в `src/design-system.css`.

- [Контракт компонентов и адаптации](../../../docs/DESIGN-SYSTEM.md).
- `tokens.json` — 187 токенов с типом и происхождением каждого значения.
- `tokens.css`, `fonts.css` — генерируемые файлы.
- `source/inventory.json` — полный инвентарь literal CSS из прототипа.
- `source/provenance.json` — SHA-256 исходника и каждого ресурса.
- `source/prototype.*` — извлечённый текст для проверки происхождения; приложение
  его не загружает.
- `licenses/` — лицензии шрифтов; копии включены в публичные font assets.

```sh
node scripts/extract-prototype.mjs
node scripts/extract-prototype.mjs --check
```

Извлечение не исполняет JavaScript артефакта. Публичный каталог содержит только
16 font subsets, PNG и лицензии. Исходный bundled HTML остаётся нетронутым.
