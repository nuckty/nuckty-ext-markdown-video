# nuckty-ext-markdown-video

> **Встраивание видео — конструкция `@[provider](id)`.**

Markdown-расширение для [nuckty](https://github.com/nuckty/nuckty). Встраивает видео с YouTube, RuTube или VK одной строкой разметки. Расширение не добавляет зависимости JavaScript в артефакт: разметка iframe статична. Готового блока в пакете нет.

## Конструкция markdown-разметки

```md
@[youtube](dQw4w9WgXcQ)
@[rutube](abc123)
```

Обработчик находит конструкцию и заменяет её готовой разметкой плеера:

```html
<div class=video><iframe class=video__iframe src=https://www.youtube.com/embed/dQw4w9WgXcQ title="youtube video" loading=lazy allowfullscreen></iframe></div>
```

Провайдеры: `youtube`, `rutube`, `vk` — регистр не важен. Незнакомый провайдер остаётся обычным текстом со ссылкой.

## Свои провайдеры

Пакет экспортирует `createVideoPlugin` и `DEFAULT_VIDEO_PROVIDERS`. Свой провайдер задаётся именем и функцией, которая строит URL:

```ts
import { createVideoPlugin, DEFAULT_VIDEO_PROVIDERS } from 'nuckty-ext-markdown-video';

import type { NucktyEnv } from 'nuckty';

export function register(env: NucktyEnv): void {
    env.markdown.use(createVideoPlugin([
        ...DEFAULT_VIDEO_PROVIDERS,
        { name: 'vimeo', src: (id) => `https://player.vimeo.com/video/${id}` },
    ]) as Parameters<typeof env.markdown.use>[0]);
}
```

Сохраните модуль как `ext/video.ts` и укажите `./ext/video.ts` в `ext` вместо `nuckty-ext-markdown-video`. Использование обоих одновременно повторно зарегистрирует преобразование. Для VK доступны идентификатор `-123_456` и полный адрес HTTPS `video_ext.php` на vk.com, vk.ru или vkvideo.ru; некорректный аргумент VK вызывает ошибку. Встроенный iframe может загружать код стороннего плеера; само расширение не добавляет бандл JS.

## Как подключить

```bash
npm install nuckty-ext-markdown-video
```

Пример продолжает быстрый старт со стандартным обработчиком `nuckty-ext-block-root`. Добавьте новое расширение в `ext` глобального `config/config-nuckty.ts`, сохранив остальные записи. Если обработчик документа собственный, оставьте его вместо `nuckty-ext-block-root`.

```ts
import { defineNucktyConfig } from 'nuckty';

export default defineNucktyConfig({
    targets: { main: { configDir: 'config/', outDir: 'site/' } },
    ext: ['nuckty-ext-block-root', 'nuckty-ext-markdown-video'],
});
```

После этого конструкция `@[provider](id)` работает в любом `.md`. Добавьте стили для классов `video` и `video__iframe` в свой CSS.

## Контракт

`register(env: NucktyEnv)` подключает `remarkVideoEmbed` через `env.markdown.use`.

## Спецификация

Поведение закреплено в спецификации openspec `ext-markdown-video` (`openspec/specs/ext-markdown-video/spec.md`).

## Лицензия

MIT.

