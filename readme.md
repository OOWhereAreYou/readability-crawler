
# Readability Crawler

Readability Crawler 是一款基于 Node.js 的爬虫，可以爬取网页的标题、正文、发布时间、作者、语言、长度、摘要、截图等信息。

代码是根据 https://github.com/jina-ai/reader 改过来的，根据自己的需求简化了一些。

目的是根据url提取出方便格式化方便阅读markdown的文章内容。


使用示例：

```javascript
const { CrawlerHost } = require("readability-crawler");
const crawler = async () => {
  let crawlerHost = new CrawlerHost();
  await crawlerHost.init();
  const url = "https://mp.weixin.qq.com/s/zzNSI5HV4LHy1f8--5-OOA";
  let result = await crawlerHost.crawl(url);
  console.log(result?.content);
  await crawlerHost.close();
  return;
};

crawler();

// result:
// interface FormatMarkdownResult {
//     title: string; // 标题
//     url: string; // 链接
//     content: string; // 内容
//     publishedTime: string | undefined; // 发布时间
//     siteName: string | undefined; // 网站名称
//     byline: string | undefined; // 作者
//     lang: string | undefined; // 语言
//     length: number | undefined; // 长度
//     excerpt: string | undefined; // 摘要
//     screenShot: Buffer | undefined; // 截图
// }


```