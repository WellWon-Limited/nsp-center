# Промпты фотографий для карточки Сок Алоэ Вера

Фотографии для выбранной карточки NSP Center: бутылка с листьями алоэ, листья и мякоть, макрофото геля. Оформление карточки описано в [ALOE-PRODUCT-CARD.md](ALOE-PRODUCT-CARD.md).

## Общие требования

Единая гамма — светлая мята, шалфейный зелёный, светлый камень. Ориентиры: `#eaf3f1`, `#dbe9df`, `#1d3a36`. Свет мягкий, рассеянный; фактуры натуральные и подробные. Кадр сдержанный, но полноценный: без пустого белого студийного фона, пёстрого декора, ярких бликов и жёстких теней. Внешние надписи и рекламные метки в изображение не добавляются.

Для бутылки используется **российская упаковка 473 мл**, с русским и английским названием. Локальный референс упаковки — `design/product-references/aloe-473-russian-front.jpg`. Сохранять форму пластиковой бутылки, прямую крышку, ребристую горловину и соотношение ширины и высоты. Надписи: «Сок Алоэ Вера НСП», «Aloe Vera Juice NSP», «473 мл». Проверять текст этикетки после генерации.

Референсы нужны для сохранения упаковки и единства фото. Они не должны подменяться фотографиями другой страны, объёма или редакции упаковки.

## Основное фото с бутылкой

Используется файл `public/images/aloe-gallery-2026-11-13/aloe-russian-botanical-v3-centered.png`, 1122×1402 px. Фон непрозрачный. Кадр портретный, близкий к 4:5. Бутылка по центру, полностью видна; её высота в исходнике занимает около трёх четвертей холста. Под ней светлый камень, рядом листья алоэ и небольшой срез с прозрачной мякотью.

### Промпт для создания аналогичного кадра

Это самостоятельная формулировка для повторного создания сцены. Входные изображения — актуальная российская упаковка и сохранённый финальный кадр как референс света и фактур.

```text
Create a premium photorealistic product photograph for NSP Center, portrait 4:5.
Use the supplied Russian 473 ml Aloe Vera bottle reference as the exact packaging
reference. Preserve the upright bottle's physical aspect ratio, straight cap,
ribbed neck, white plastic and green Russian and English label. Preserve readable
texts: “Сок Алоэ Вера НСП”, “Aloe Vera Juice NSP”, “473 мл”. Do not change the
bottle volume, invent another package or distort the cap.

The complete bottle including cap occupies approximately 75 percent of the
image height. Centre the bottle itself horizontally and vertically, with equal
breathing room above its cap and below its base. Keep the full cap and base
visible. A softly textured pale sage stone surface supports the bottle. Place
two natural aloe leaves and one small translucent aloe gel section near the
base, without covering the label.

Use a restrained pale mint and sage palette inspired by #eaf3f1 and #dbe9df.
The softly blurred botanical background fills the entire frame edge to edge.
Match the preserved final scene's diffused daylight and realistic stone,
plastic and leaf textures. Sharp bottle detail, legible label, quiet background.
No harsh shadows, bright glare, glow halo, white margins, inset photo frame,
extra containers, promotional badges or text outside the bottle.
```

### Точный финальный промпт редактирования выбранного кадра

Этот промпт применялся к промежуточному кадру `aloe-russian-botanical-v2-smaller.png` с референсом российской упаковки. Сохранённый результат — `aloe-russian-botanical-v3-centered.png`. Промежуточный кадр в галерею сайта не входит.

```text
Refine reference 1 with ONE controlled composition change: make the SAME upright
Russian 473ml aloe bottle about 16% larger than it is now, keeping its physical
shape and label exactly from reference 2. Final bottle height including cap
must occupy 74-76% of total portrait image height, NOT 90%, NOT 63%. Bottle
bounding-box center must be exactly at horizontal center and approximately at
vertical center of the canvas: cap near y=12%, base near y=88%, bottle center
y=50%. Entire cap and base visible. Keep the same mint/sage natural photographic
background, stone foreground, aloe leaves and small gel section around base.
Expand/rearrange only nearby botanical props as needed to fit the centered
bottle naturally. Preserve exact straight cap, ribbed neck, plastic proportions
and Russian/English green label, 'Сок Алоэ Вера НСП', 'Aloe Vera Juice NSP',
'473 мл'. No extra text, no frame, no white margins, same photorealistic diffused
daylight, restrained premium e-commerce style. Portrait 4:5, edge-to-edge full scene.
```

Окончательное равенство верхнего и нижнего отступов обеспечивается центрированием самой бутылки при показе изображения. Одного `object-position: center` для этого недостаточно: центр предмета не обязан совпадать с центром исходного файла. Геометрия сохранена в [описании карточки](ALOE-PRODUCT-CARD.md#центрирование-бутылки).

Для будущих небольших правок брать именно финальный кадр и менять только нужную деталь. Не перегенерировать одновременно упаковку, фон, свет и композицию ради одного изменения размера.

## Листья алоэ и срез

Используется `public/images/aloe-gallery-2026-11-13/aloe-leaves-v1.png`, 1254×1254 px. На светлом камне лежат листья с каплями воды и срез с прозрачной мякотью. Бутылки и текста нет.

Промпт ниже нормализован для повторного создания; это не побайтная запись исходного запроса.

```text
Premium photorealistic botanical still life for a restrained pale mint and sage
wellness product website. Square photograph. Two fresh aloe vera leaves resting
naturally on softly textured light sage stone, with one small cut cross-section
showing clear translucent gel in the foreground. Fine realistic leaf texture,
natural small water droplets and carefully formed leaf edges. Soft diffused
daylight, gentle tonal depth, detailed natural surfaces. Match the supplied
final Aloe Vera product photograph's colour, light and material treatment.
Balanced quiet composition with enough visual substance, not a tiny leaf in
an empty white scene. No bottle, packaging, text, label, badges, vivid saturated
props, glow or harsh cast shadows. Fill the complete square image with the scene.
```

## Макрофотография геля

Используется `public/images/aloe-gallery-2026-11-13/aloe-gel-v1.png`, 1254×1254 px. Главный объект — срез листа с прозрачной мякотью. Позади несколько частей листа в мягком расфокусе.

Промпт ниже нормализован для повторного создания; это не побайтная запись исходного запроса.

```text
High quality photorealistic macro photograph of a freshly cut aloe vera leaf
section with clear translucent gel, resting on pale sage textured stone.
Square composition. Make the gel and natural leaf cross-section the main
subject, with realistic transparent structure, tiny natural droplets and a
thin green rind. A few aloe leaf forms recede softly into the background.
Match the supplied Aloe Vera product scene: restrained pale mint and sage
colours, soft diffused daylight, realistic stone and botanical textures,
quiet premium photography. Detailed, calm and cohesive rather than busy or
clinical. No bottle, glass, packaging, white studio void, labels, decorative
text, promotional marks, strong glare or hard shadows. Edge-to-edge photograph.
```

## Проверка перед заменой фотографий

- Объём и двуязычная этикетка совпадают с российским референсом упаковки.
- Крышка прямая; ребристая горловина и пропорции бутылки сохранены.
- Бутылка полностью видна и отцентрирована по своим границам.
- Растения не перекрывают название и объём на этикетке.
- Все три фото согласованы по свету, зелёной гамме и фактуре камня.
- Миниатюры заполняются изображением, без белых рамок и полей.
- Оценка сделана в галерее карточки, включая изменение ширины окна.

Сохранённые файлы имеют указанные выше собственные размеры, не 4K. Генерация может менять детали и написание текста; промпт не заменяет визуальную сверку финального изображения с упаковкой.
