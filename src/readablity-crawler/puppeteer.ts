
import type { Browser } from 'puppeteer';
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
const READABILITY_JS = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf-8');
export interface ImgBrief {
    src: string;
    loaded: boolean;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
    alt?: string;
}

export interface ReadabilityParsed {
    title: string; // 标题
    content: string; // 内容
    textContent: string; // 纯文本内容
    length: number; // 字符数
    excerpt: string; // 摘要
    byline: string; // 作者
    dir: string; // 阅读方向
    siteName: string; // 网站名称
    lang: string; // 语言
    publishedTime: string; // 发布时间
}

export interface PageSnapshot {
    title: string;
    href: string;
    html: string;
    text: string;
    parsed?: Partial<ReadabilityParsed> | null;
    screenshot?: Buffer;
    imgs?: ImgBrief[];
}


const puppeteerStealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(puppeteerStealth());

const puppeteerBlockResources = require('puppeteer-extra-plugin-block-resources');
puppeteer.use(puppeteerBlockResources({
    blockedTypes: new Set(['media']),
}));

//@singleton()
export class PuppeteerControl {
    browser!: Browser;
    async init() {
        this.browser = await puppeteer.launch({
            timeout: 10_000
        });
    }
    async newPage() {
        const dedicatedContext = (await this.browser.createBrowserContext());
        const page = await dedicatedContext.newPage();
        const preparations: Promise<any>[] = [];
        preparations.push(page.setUserAgent(`Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)`));
        preparations.push(page.setUserAgent(`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)`));
        preparations.push(page.setBypassCSP(true));
        preparations.push(page.setViewport({ width: 1024, height: 1024 }));
        preparations.push(page.exposeFunction('reportSnapshot', (snapshot: any) => {
            page.emit('snapshot', snapshot);
        }));
        preparations.push(page.evaluateOnNewDocument(READABILITY_JS));
        preparations.push(page.evaluateOnNewDocument(`
function briefImgs(elem) {
    const imageTags = Array.from((elem || document).querySelectorAll('img[src]'));

    return imageTags.map((x)=> ({
        src: x.src,
        loaded: x.complete,
        width: x.width,
        height: x.height,
        naturalWidth: x.naturalWidth,
        naturalHeight: x.naturalHeight,
        alt: x.alt || x.title,
    }));
}
function giveSnapshot() {
    let parsed;
    try {
        parsed = new Readability(document.cloneNode(true)).parse();
    } catch (err) {
        void 0;
    }

    const r = {
        title: document.title,
        href: document.location.href,
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        parsed: parsed,
        imgs: [],
    };
    if (parsed && parsed.content) {
        const elem = document.createElement('div');
        elem.innerHTML = parsed.content;
        r.imgs = briefImgs(elem);
    }

    return r;
}
`));
        preparations.push(page.evaluateOnNewDocument(() => {
            let aftershot: any;
            const handlePageLoad = () => {
                if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
                    return;
                }
                // @ts-expect-error
                const parsed = giveSnapshot();
                if (parsed) {
                    // @ts-expect-error
                    window.reportSnapshot(parsed);
                } else {
                    if (aftershot) {
                        clearTimeout(aftershot);
                    }
                    aftershot = setTimeout(() => {
                        // @ts-expect-error
                        window.reportSnapshot(giveSnapshot());
                    }, 500);
                }
            };
            // setInterval(handlePageLoad, 1000);
            // @ts-expect 
            document.addEventListener('readystatechange', handlePageLoad);
            // @ts-expect 
            document.addEventListener('load', handlePageLoad);
        }));
        await Promise.all(preparations);
        return page;
    }

    async scrap(url: string, hasScreenShot: boolean = false): Promise<PageSnapshot | undefined> {
        let snapshot: PageSnapshot | undefined;
        let screenshot: Buffer | undefined;
        const page = await this.newPage()
        await page.goto(url, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'], timeout: 30_000 })
        screenshot = hasScreenShot ? await page.screenshot({
            type: 'jpeg',
            quality: 75,
        }) : undefined;
        snapshot = await page.evaluate('giveSnapshot()') as PageSnapshot;
        snapshot.screenshot = screenshot;
        page.close();
        return snapshot
    }

}


export default PuppeteerControl;
