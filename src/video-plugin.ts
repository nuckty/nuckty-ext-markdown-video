/**
 * Video embed remark plugin — maps @[provider](id) to mdast html nodes carrying
 * the embed markup. The Markdown bridge then creates BEMJSON raw nodes.
 *
 * remark parses `@[youtube](bsgLJcQz43s)` as a paragraph whose children are a
 * text node ending in `@` followed by a link whose only child is the provider
 * name and whose `url` is the video id. This plugin walks the mdast tree before
 * the mdast→BEMJSON bridge, replaces that two-node pattern with a single `html`
 * node carrying the embed markup, and drops the `@`. The bridge then turns the
 * `html` node into a `raw` BemNode; the paragraph-special-case in the bridge
 * emits it block-level (no `<p>` wrapper), matching the golden output.
 *
 * Providers: `youtube` (default), plus `rutube` and `vk`. An unknown provider is
 * left untouched (the `@` + link render as ordinary text + link).
 *
 * @module video-plugin
 */

import { render, Templates } from 'nuckty';
import type { Plugin } from 'unified';
import type { Root, Paragraph, Html, Link, Text, PhrasingContent } from 'mdast';

export interface VideoProvider {
    /** Matches the link's only-text-child (lowercased) and the provider name. */
    name: string;
    /** Builds the iframe `src` from the video id (the link's `url`). */
    src: (id: string) => string;
}

/** The default providers: YouTube, RuTube, VK. */
export const DEFAULT_VIDEO_PROVIDERS: VideoProvider[] = [
    { name: 'youtube', src: (id) => `https://www.youtube.com/embed/${id}` },
    { name: 'rutube', src: (id) => `https://rutube.ru/play/embed/${id}` },
    { name: 'vk', src: (id) => {
        if (/^https:\/\/(?:vk\.com|vk\.ru|vkvideo\.ru)\/video_ext\.php\?/.test(id)) {
            return id;
        }
        const match = /^(-?\d+)_(\d+)$/.exec(id);

        if (!match) {
            throw new Error('VK video requires owner_id_video_id or a full video_ext.php embed URL');
        }

        return `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}`;
    } },
];

/** Build an iframe embed HTML string for a provider + id. */
function embedHtml(provider: VideoProvider, id: string): string {
    const src = provider.src(id);
    return render({ block: 'video', content: { tag: 'iframe', block: 'video', elem: 'iframe', attrs: { src, title: `${provider.name} video`, loading: 'lazy', allowfullscreen: true } } }, { templates: new Templates() });
}

/** Find a provider by its lowercase name (link's only-text-child), or null. */
function findProvider(name: string, providers: VideoProvider[]): VideoProvider | null {
    const lower = name.toLowerCase();
    return providers.find((p) => p.name.toLowerCase() === lower) ?? null;
}

/**
 * Create the remark plugin with a provider list. A paragraph whose children
 * contain a `text ending in '@'` immediately followed by `link(provider)` is
 * rewritten: the `@` is dropped from the text, the link is replaced by an
 * `html` node carrying the embed.
 */
export function createVideoPlugin(providers: VideoProvider[] = DEFAULT_VIDEO_PROVIDERS): Plugin<[], Root> {
    return () => {
        return (tree: Root) => {
            const walk = (node: { type: string; children?: unknown[] }): void => {
                if (node.type === 'paragraph') {
                    rewriteParagraph(node as Paragraph, providers);
                } else {
                    for (const child of node.children ?? []) {
                        walk(child as { type: string; children?: unknown[] });
                    }
                }
            };
            walk(tree);
        };
    };
}

/** Rewrite a paragraph: replace `text('@')+link(provider)` pairs with an embed. */
function rewriteParagraph(para: Paragraph, providers: VideoProvider[]): void {
    const kids = para.children;
    if (kids.length < 2) return;
    const out: PhrasingContent[] = [];
    for (let i = 0; i < kids.length; i++) {
        const cur = kids[i]!;
        const next = kids[i + 1];
        if (cur.type === 'text' && next && next.type === 'link') {
            const embed = matchEmbed(cur as Text, next as Link, providers);
            if (embed) {
                // If the text node had content before `@`, keep it as a text node.
                if (embed.beforeText !== '') out.push({ type: 'text', value: embed.beforeText });
                out.push(embed.html);
                i++; // consume the link
                continue;
            }
        }
        out.push(cur);
    }
    para.children = out;
}

/** Match a `text('@...')` + `link(provider)` pair → `{ html, beforeText }`, or null. */
function matchEmbed(
    atText: Text,
    link: Link,
    providers: VideoProvider[],
): { html: Html; beforeText: string } | null {
    // The text node must end in `@` (the `@` may follow other text).
    const match = atText.value.match(/^(.*)@$/s);
    if (!match) return null;
    const beforeText = match[1] ?? '';
    // The link's only child must be a text node naming a known provider.
    if (link.children.length !== 1) return null;
    const only = link.children[0]!;
    if (only.type !== 'text') return null;
    const provider = findProvider((only as Text).value, providers);
    if (!provider) return null;
    const id = link.url;
    if (!id) return null;
    return {
        html: { type: 'html', value: embedHtml(provider, id) },
        beforeText,
    };
}

/**
 * Default plugin (default providers). Registered by the extension's `register`
 * via `env.markdown.use(remarkVideoEmbed)`.
 */
export const remarkVideoEmbed: Plugin<[], Root> = createVideoPlugin();

