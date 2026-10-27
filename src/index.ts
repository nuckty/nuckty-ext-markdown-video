/**
 * @nuckty/ext-markdown-video — video embed via `@[provider](id)` (a markdown-extension).
 *
 * Registers a remark mdast plugin via `env.markdown.use(remarkVideoEmbed)`
 * (openspec `ext-markdown-video`): it walks mdast before the mdast → BEMJSON bridge
 * and rewrites the `@[provider](id)` syntax (a text node ending in `@` followed
 * by a link whose label is a provider name) into an `html` node carrying
 * `<div class=video><iframe ...></iframe></div>`. The bridge turns that `html`
 * node into a `raw` BemNode and emits it block-level (no `<p>` wrapper).
 *
 * Default providers: YouTube, RuTube, VK. A site loads this extension to get
 * video embeds; without it, `@[youtube](id)` renders as ordinary text + link.
 *
 * @module @nuckty/ext-markdown-video
 */

import type { NucktyEnv } from '@nuckty/core';
export { remarkVideoEmbed, createVideoPlugin, DEFAULT_VIDEO_PROVIDERS } from './video-plugin.js';
export type { VideoProvider } from './video-plugin.js';

import { remarkVideoEmbed } from './video-plugin.js';

export function register(env: NucktyEnv): void {
    env.markdown.use(remarkVideoEmbed);
}

export default register;
