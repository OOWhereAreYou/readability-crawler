"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerHost = void 0;
const puppeteer_1 = require("./puppeteer");
const normalize_url_1 = __importDefault(require("@esm2cjs/normalize-url"));
const turndown_1 = __importDefault(require("turndown"));
function tidyMarkdown(markdown) {
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
        }
        else {
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
function cleanAttribute(attribute) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}
class CrawlerHost {
    constructor(hasScreenShot = false) {
        this.turnDownPlugins = [require('turndown-plugin-gfm').tables];
        this.puppeteerControl = new puppeteer_1.PuppeteerControl();
        this.hasScreenShot = hasScreenShot;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.puppeteerControl.init();
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.puppeteerControl.browser.close();
        });
    }
    formatSnapshot(snapshot, nominalUrl) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return __awaiter(this, void 0, void 0, function* () {
            const toBeTurnedToMd = (_a = snapshot.parsed) === null || _a === void 0 ? void 0 : _a.content;
            let turnDownService = new turndown_1.default();
            for (const plugin of this.turnDownPlugins) {
                turnDownService = turnDownService.use(plugin);
            }
            let contentText = '';
            if (toBeTurnedToMd) {
                const urlToAltMap = {};
                (snapshot.imgs || []).map((x) => __awaiter(this, void 0, void 0, function* () {
                    if (x.src) {
                        urlToAltMap[x.src.trim()] = x.alt || '';
                    }
                }));
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
                }
                catch (err) {
                    const vanillaTurnDownService = new turndown_1.default();
                    try {
                        contentText = vanillaTurnDownService.turndown(toBeTurnedToMd).trim();
                    }
                    catch (err2) {
                    }
                }
            }
            if (!contentText || (contentText.startsWith('<') && contentText.endsWith('>'))) {
                try {
                    contentText = turnDownService.turndown(snapshot.html);
                }
                catch (err) {
                    const vanillaTurnDownService = new turndown_1.default();
                    try {
                        contentText = vanillaTurnDownService.turndown(snapshot.html);
                    }
                    catch (err2) {
                    }
                }
            }
            if (!contentText || (contentText.startsWith('<') || contentText.endsWith('>'))) {
                contentText = snapshot.text;
            }
            const cleanText = tidyMarkdown(contentText || '').trim();
            const formatted = {
                title: (((_b = snapshot.parsed) === null || _b === void 0 ? void 0 : _b.title) || snapshot.title || '').trim(),
                url: nominalUrl || ((_c = snapshot.href) === null || _c === void 0 ? void 0 : _c.trim()),
                content: cleanText,
                publishedTime: ((_d = snapshot.parsed) === null || _d === void 0 ? void 0 : _d.publishedTime) || undefined,
                siteName: ((_e = snapshot.parsed) === null || _e === void 0 ? void 0 : _e.siteName) || undefined,
                byline: ((_f = snapshot.parsed) === null || _f === void 0 ? void 0 : _f.byline) || undefined,
                lang: ((_g = snapshot.parsed) === null || _g === void 0 ? void 0 : _g.lang) || undefined,
                length: ((_h = snapshot.parsed) === null || _h === void 0 ? void 0 : _h.length) || undefined,
                excerpt: ((_j = snapshot.parsed) === null || _j === void 0 ? void 0 : _j.excerpt) || undefined,
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
        });
    }
    crawl(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const noSlashURL = url;
            let urlToCrawl;
            try {
                urlToCrawl = new URL((0, normalize_url_1.default)(noSlashURL.trim(), { stripWWW: false, removeTrailingSlash: false, removeSingleSlash: false }));
                if (urlToCrawl.protocol !== 'http:' && urlToCrawl.protocol !== 'https:') {
                    return null;
                }
            }
            catch (err) {
                return null;
            }
            let lastScrapped = yield this.puppeteerControl.scrap(urlToCrawl.toString(), this.hasScreenShot);
            if (!lastScrapped) {
                return null;
            }
            return yield this.formatSnapshot(lastScrapped, urlToCrawl === null || urlToCrawl === void 0 ? void 0 : urlToCrawl.toString());
        });
    }
}
exports.CrawlerHost = CrawlerHost;
