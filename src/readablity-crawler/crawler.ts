
import _, { has } from 'lodash-es';
import { PageSnapshot, PuppeteerControl } from './puppeteer';

import normalizeUrl from "@esm2cjs/normalize-url";

import TurndownService from 'turndown';

export interface FormatMarkdownResult {
    title: string; // 标题
    url: string; // 链接
    content: string; // 内容
    publishedTime: string | undefined; // 发布时间
    siteName: string | undefined; // 网站名称
    byline: string | undefined; // 作者
    lang: string | undefined; // 语言
    length: number | undefined; // 长度
    excerpt: string | undefined; // 摘要
    screenShot: Buffer | undefined; // 截图
}

function tidyMarkdown(markdown: string): string {

    // Step 1: 处理跨多行的复杂链接，包括文本和可选图片
    let normalizedMarkdown = markdown.replace(/\[\s*([^]+?)\s*\]\s*\(\s*([^)]+)\s*\)/g, (match, text, url) => {
        // 移除文本内部的换行和多余空格
        text = text.replace(/\s+/g, ' ').trim();
        url = url.replace(/\s+/g, '').trim();
        return `[${text}](${url})`;
    });

    // 处理跨多行的复杂链接，包括文本、可选图片和链接
    normalizedMarkdown = normalizedMarkdown.replace(/\[\s*([^!]*?)\s*\n*(?:!\[([^\]]*)\]\((.*?)\))?\s*\n*\]\s*\(\s*([^)]+)\s*\)/g, (match, text, alt, imgUrl, linkUrl) => {
        // 移除多余空格和换行
        text = text.replace(/\s+/g, ' ').trim();
        alt = alt ? alt.replace(/\s+/g, ' ').trim() : '';
        imgUrl = imgUrl ? imgUrl.replace(/\s+/g, '').trim() : '';
        linkUrl = linkUrl.replace(/\s+/g, '').trim();
        if (imgUrl) {
            return `[${text} ![${alt}](${imgUrl})](${linkUrl})`;
        } else {
            return `[${text}](${linkUrl})`;
        }
    });

    // Step 2: 标准化可能跨行的常规链接
    normalizedMarkdown = normalizedMarkdown.replace(/\[\s*([^\]]+)\]\s*\(\s*([^)]+)\)/g, (match, text, url) => {
        text = text.replace(/\s+/g, ' ').trim();
        url = url.replace(/\s+/g, '').trim();
        return `[${text}](${url})`;
    });

    // Step 3: 将两个以上的连续空行替换为仅两个空行
    normalizedMarkdown = normalizedMarkdown.replace(/\n{3,}/g, '\n\n');

    // Step 4: 移除每行开头的空格
    normalizedMarkdown = normalizedMarkdown.replace(/^[ \t]+/gm, '');

    return normalizedMarkdown.trim();
}
function cleanAttribute(attribute: string) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}
export class CrawlerHost {
    turnDownPlugins = [require('turndown-plugin-gfm').tables];
    puppeteerControl: PuppeteerControl;
    hasScreenShot: boolean;
    constructor(
        hasScreenShot: boolean = false
    ) {
        this.puppeteerControl = new PuppeteerControl();
        this.hasScreenShot = hasScreenShot;
    }
    async init() {
        await this.puppeteerControl.init();
    }
    async close() {
        await this.puppeteerControl.browser.close();
    }

    async formatSnapshot(snapshot: PageSnapshot, nominalUrl?: string) {
        const toBeTurnedToMd = snapshot.parsed?.content;
        let turnDownService = new TurndownService();
        for (const plugin of this.turnDownPlugins) {
            turnDownService = turnDownService.use(plugin);
        }
        let contentText = '';
        if (toBeTurnedToMd) {
            const urlToAltMap: { [k: string]: string | undefined; } = {};
            (snapshot.imgs || []).map(async (x) => {
                if (x.src) {
                    urlToAltMap[x.src.trim()] = x.alt || '';
                }
            });
            let imgIdx = 0;
            turnDownService.addRule('img-generated-alt', {
                filter: 'img',
                replacement: (_content, node) => {
                    // @ts-ignore
                    const src = (node.getAttribute('src') || '').trim();
                    // @ts-ignore
                    const alt = cleanAttribute(node.getAttribute('alt'));
                    if (!src) {
                        return '';
                    }
                    const mapped = urlToAltMap[src];
                    imgIdx++;
                    if (mapped) {
                        return `![Image ${imgIdx}: ${mapped || alt}](${src})`;
                    }
                    return `![Image ${imgIdx}: ${alt}](${src})`;
                }
            });

            try {
                contentText = turnDownService.turndown(toBeTurnedToMd).trim();
            } catch (err) {
                const vanillaTurnDownService = new TurndownService();
                try {
                    contentText = vanillaTurnDownService.turndown(toBeTurnedToMd).trim();
                } catch (err2) {
                }
            }
        }

        if (!contentText || (contentText.startsWith('<') && contentText.endsWith('>'))) {
            try {
                contentText = turnDownService.turndown(snapshot.html);
            } catch (err) {
                const vanillaTurnDownService = new TurndownService();
                try {
                    contentText = vanillaTurnDownService.turndown(snapshot.html);
                } catch (err2) {
                }
            }
        }
        if (!contentText || (contentText.startsWith('<') || contentText.endsWith('>'))) {
            contentText = snapshot.text;
        }

        const cleanText = tidyMarkdown(contentText || '').trim();

        const formatted = {
            title: (snapshot.parsed?.title || snapshot.title || '').trim(),
            url: nominalUrl || snapshot.href?.trim(),
            content: cleanText,
            publishedTime: snapshot.parsed?.publishedTime || undefined,
            siteName: snapshot.parsed?.siteName || undefined,
            byline: snapshot.parsed?.byline || undefined,
            lang: snapshot.parsed?.lang || undefined,
            length: snapshot.parsed?.length || undefined,
            excerpt: snapshot.parsed?.excerpt || undefined,
            screenShot: this.hasScreenShot ? snapshot.screenshot || undefined : undefined,
            //             toString() {
            //                 const mixins: any = [];
            //                 if (this.publishedTime) {
            //                     mixins.push(`Published Time: ${this.publishedTime}`);
            //                 }

            //                 return `Title: ${this.title}

            // URL Source: ${this.url}
            // ${mixins.length ? `\n${mixins.join('\n\n')}\n` : ''}
            // Markdown Content:
            // ${this.content}

            // `;
            //             }
        };

        return formatted;
    }

    async crawl(
        url: string,
    ): Promise<FormatMarkdownResult | null> {
        const noSlashURL = url
        let urlToCrawl;
        try {
            urlToCrawl = new URL(normalizeUrl(noSlashURL.trim(), { stripWWW: false, removeTrailingSlash: false, removeSingleSlash: false }));
            if (urlToCrawl.protocol !== 'http:' && urlToCrawl.protocol !== 'https:') {
                return null
            }
        } catch (err) {
            return null
        }
        let lastScrapped = await this.puppeteerControl.scrap(urlToCrawl.toString(), this.hasScreenShot);
        if (!lastScrapped) {
            return null;
        }

        return await this.formatSnapshot(lastScrapped, urlToCrawl?.toString());
    }
}

