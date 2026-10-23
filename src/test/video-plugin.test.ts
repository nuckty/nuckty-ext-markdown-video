/**
 * Tests for the video embed remark plugin (openspec `ext-markdown-video`):
 * `@[provider](id)` is rewritten to an `html` node carrying
 * `<div class=video><iframe ...></iframe></div>` before the mdast→BEMJSON
 * bridge. Non-trivial: remark parses `@[youtube](id)` as a text node ending in
 * `@` followed by a link whose only child is the provider name; the plugin must
 * drop the `@`, keep any text before it, and ignore unknown providers (which
 * render as ordinary text + link).
 *
 * @module test/video-plugin
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Html, Text, Link } from 'mdast';
import { remarkVideoEmbed, createVideoPlugin, DEFAULT_VIDEO_PROVIDERS } from '../index.js';

/** Run the plugin's mdast transform on a parsed tree (the same way the unified
 *  pipeline does — via `runSync`, not a bare `.parse()`: `parse` only parses, it
 *  does not apply remark transformers). */
function applyPlugin(tree: Root, plugin = remarkVideoEmbed): Root {
    return unified().use(plugin).runSync(tree) as Root;
}

/** Parse + apply the plugin, return the paragraph's children (typed). */
function paraChildren(src: string): Array<{ type: string; value?: string; url?: string; children?: unknown[] }> {
    const tree = applyPlugin(unified().use(remarkParse).parse(src) as Root);
    const para = tree.children[0];
    if (!para || para.type !== 'paragraph') return [];
    return para.children.map((c) => {
        if (c.type === 'html') return { type: 'html', value: (c as Html).value };
        if (c.type === 'text') return { type: 'text', value: (c as Text).value };
        if (c.type === 'link') return { type: 'link', url: (c as Link).url, children: (c as Link).children };
        return { type: c.type };
    });
}

// ---- @[youtube](id) ---------------------------------------------------------

test('youtube: `@[youtube](id)` becomes a single html embed node', () => {
    const kids = paraChildren('@[youtube](bsgLJcQz43s)');
    assert.equal(kids.length, 1);
    assert.equal(kids[0]!.type, 'html');
    assert.equal(
        kids[0]!.value,
        '<div class=video><iframe class=video__iframe src=https://www.youtube.com/embed/bsgLJcQz43s title="youtube video" loading=lazy allowfullscreen></iframe></div>',
    );
});

test('youtube: the `@` text node is dropped (no leftover `@` text node)', () => {
    const kids = paraChildren('@[youtube](bsgLJcQz43s)');
    assert.ok(!kids.some((k) => k.type === 'text' && k.value === '@'), 'leftover @ text');
    assert.ok(!kids.some((k) => k.type === 'link'), 'leftover link node');
});

// ---- providers: rutube, vk --------------------------------------------------

test('rutube: maps to the rutube embed URL', () => {
    const kids = paraChildren('@[rutube](abc123)');
    assert.equal(kids.length, 1);
    assert.equal(kids[0]!.type, 'html');
    assert.ok(kids[0]!.value!.includes('https://rutube.ru/play/embed/abc123'), kids[0]!.value);
});

test('vk: maps to the vk video_ext URL', () => {
    const kids = paraChildren('@[vk](12345_67890)');
    assert.equal(kids.length, 1);
    assert.ok(kids[0]!.value!.includes('https://vk.com/video_ext.php?oid=12345&amp;id=67890'), kids[0]!.value);
});

test('VK accepts a signed owner and preserves a full embed URL including its hash', () => {
    const provider = DEFAULT_VIDEO_PROVIDERS.find((candidate) => candidate.name === 'vk')!;
    const url = new URL(provider.src('-12345_67890'));

    assert.equal(url.searchParams.get('oid'), '-12345');
    assert.equal(url.searchParams.get('id'), '67890');
    const full = 'https://vkvideo.ru/video_ext.php?oid=-12345&id=67890&hash=fixture';

    assert.equal(provider.src(full), full);
    assert.ok(paraChildren(`@[vk](${full})`)[0]?.value?.includes('hash=fixture'));
    assert.throws(() => paraChildren('@[vk](invalid)'), /VK video requires/);
});

test('provider match is case-insensitive', () => {
    const kids = paraChildren('@[YouTube](bsgLJcQz43s)');
    assert.equal(kids.length, 1);
    assert.equal(kids[0]!.type, 'html');
});

// ---- unknown provider / non-matching shapes --------------------------------

test('unknown provider: left as ordinary text + link (no embed)', () => {
    const kids = paraChildren('@[unknown](id)');
    assert.ok(kids.some((k) => k.type === 'text' && k.value!.endsWith('@')), 'kept the @ text');
    assert.ok(kids.some((k) => k.type === 'link'), 'kept the link');
    assert.ok(!kids.some((k) => k.type === 'html'), 'no html embed');
});

test('a link not preceded by `@` is not treated as a video', () => {
    const kids = paraChildren('see [youtube](https://youtube.com)');
    assert.ok(!kids.some((k) => k.type === 'html'), 'plain link became a video');
    assert.ok(kids.some((k) => k.type === 'link'));
});

test('a link whose only child is not a text node is not a video', () => {
    // `[![alt](img.png)](id)` — link's only child is an image, not a provider name.
    const kids = paraChildren('@[![alt](img.png)](id)');
    assert.ok(!kids.some((k) => k.type === 'html'), 'image-link became a video');
});

test('an empty id is not an embed (the link is kept)', () => {
    const kids = paraChildren('@[youtube]()');
    // No id → no embed; the @ + link render as ordinary content.
    assert.ok(!kids.some((k) => k.type === 'html'), 'empty id produced an embed');
});

// ---- text before `@` -------------------------------------------------------

test('text before `@` is kept as a separate text node', () => {
    const kids = paraChildren('Watch this: @[youtube](bsgLJcQz43s)');
    const text = kids.filter((k) => k.type === 'text').map((k) => k.value).join('');
    assert.ok(text.includes('Watch this:'), `kept pre-@ text: ${text}`);
    assert.equal(kids[kids.length - 1]!.type, 'html');
});

// ---- custom providers -------------------------------------------------------

test('custom providers: a site can add its own', () => {
    const custom = createVideoPlugin([...DEFAULT_VIDEO_PROVIDERS, { name: 'peertube', src: (id) => `https://peer.tv/w/${id}` }]);
    const tree = applyPlugin(unified().use(remarkParse).parse('@[peertube](xyz)') as Root, custom);
    const para = tree.children[0]!;
    const only = (para as { children: Array<{ type: string; value?: string }> }).children[0];
    assert.equal(only!.type, 'html');
    assert.ok(only!.value!.includes('https://peer.tv/w/xyz'), only!.value);
});

test('video provider output is serialized as a single logical src value', () => {
    const kids = paraChildren('@[youtube](<abc" data-probe="yes>)');
    assert.ok(kids[0]!.value!.includes('src="https://www.youtube.com/embed/abc&quot; data-probe=&quot;yes"'));
});

test('video embeds inside blockquotes and list paragraphs are transformed', () => {
    for (const source of ['> @[youtube](abc)', '- @[youtube](abc)']) {
        const tree = applyPlugin(unified().use(remarkParse).parse(source) as Root);
        assert.ok(JSON.stringify(tree).includes('video__iframe'));
    }
});

test('custom provider configuration and authored names match independent of case', () => {
    const ids: string[] = [];
    const plugin = createVideoPlugin([{ name: 'PeerTube', src: (id) => {
        ids.push(id);

        return `https://peer.example/video/${id}`;
    } }]);

    for (const name of ['peertube', 'PEERTUBE']) {
        const tree = applyPlugin(unified().use(remarkParse).parse(`@[${name}](fixture)`) as Root, plugin);
        const output = JSON.stringify(tree);

        assert(output.includes('video__iframe'));
        assert(output.includes('https://peer.example/video/fixture'));
    }
    assert.deepEqual(ids, ['fixture', 'fixture']);
});

