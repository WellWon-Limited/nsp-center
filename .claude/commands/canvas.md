---
description: Поднять холст этой Claude-сессии в WellWon Factory
---
<!-- wellwon-canvas:command v3 -->
Подними холст СВОЕЙ сессии в канвасе. Представляться не нужно: канвас
опознаёт сессию по процессу-звонящему. Аргументы владельца: $ARGUMENTS

1. Нет `.wellwon/canvas/endpoint.json` — канвас этого проекта не поднят
   или приложение перезапускается. `cv` сам ждёт endpoint до 45 с. Не
   появился — НЕ запускай WellWon Factory сам (ни бинарь, ни `open -a`):
   боевую копию открывает только владелец — попроси его и остановись. Свои
   проверки приложения — только в тестовом инстансе (WW_TEST=1 WW_TEST_ID).
2. Один раз вызови `sh .wellwon/canvas/cv state`: ответ уже несёт твою
   сессию, холст, юниты и URL. Отдельный `cv whoami` нужен только если
   адрес в ответе выглядит неожиданно; обязательным preflight он не является.
3. There is a URL in the arguments -> `sh .wellwon/canvas/cv open <url> --focus`.
   No URL and the canvas exists -> `sh .wellwon/canvas/cv raise --focus`.
   No canvas -> find the current dev-server address in the project config/docs
   and call `sh .wellwon/canvas/cv open <url> --focus`.
   `--focus` is a request only: it marks THIS session's tab and sends one
   notification; it never switches the owner's project, tab, view or keyboard.
   The reply `attention: "visible"` means the owner is already on this tab,
   `"queued"` means the mark waits for the owner's click. Do not repeat it.
4. Answer in one line: which canvas is up/created, on which url, and the
   `attention` value.
