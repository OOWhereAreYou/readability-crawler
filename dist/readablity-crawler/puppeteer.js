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
exports.PuppeteerControl = void 0;
const fs_1 = __importDefault(require("fs"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const READABILITY_JS = fs_1.default.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf-8');
const puppeteerStealth = require('puppeteer-extra-plugin-stealth');
puppeteer_extra_1.default.use(puppeteerStealth());
const puppeteerBlockResources = require('puppeteer-extra-plugin-block-resources');
puppeteer_extra_1.default.use(puppeteerBlockResources({
    blockedTypes: new Set(['media']),
}));
//@singleton()
class PuppeteerControl {
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.browser = yield puppeteer_extra_1.default.launch({
                timeout: 10000
            });
        });
    }
    newPage() {
        return __awaiter(this, void 0, void 0, function* () {
            const dedicatedContext = (yield this.browser.createBrowserContext());
            const page = yield dedicatedContext.newPage();
            const preparations = [];
            preparations.push(page.setUserAgent(`Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)`));
            preparations.push(page.setUserAgent(`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)`));
            preparations.push(page.setBypassCSP(true));
            preparations.push(page.setViewport({ width: 1024, height: 1024 }));
            preparations.push(page.exposeFunction('reportSnapshot', (snapshot) => {
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
                let aftershot;
                const handlePageLoad = () => {
                    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
                        return;
                    }
                    // @ts-expect-error
                    const parsed = giveSnapshot();
                    if (parsed) {
                        // @ts-expect-error
                        window.reportSnapshot(parsed);
                    }
                    else {
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
            yield Promise.all(preparations);
            return page;
        });
    }
    scrap(url, hasScreenShot = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let snapshot;
            let screenshot;
            const page = yield this.newPage();
            yield page.goto(url, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'], timeout: 30000 });
            screenshot = hasScreenShot ? yield page.screenshot({
                type: 'jpeg',
                quality: 75,
            }) : undefined;
            snapshot = (yield page.evaluate('giveSnapshot()'));
            snapshot.screenshot = screenshot;
            page.close();
            return snapshot;
        });
    }
}
exports.PuppeteerControl = PuppeteerControl;
exports.default = PuppeteerControl;
