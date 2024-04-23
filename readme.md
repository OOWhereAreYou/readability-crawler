

```javascript
import { CrawlerHost } from "./readablity-crawler/crawler"
const crawler = async () => {
  let crawlerHost = new CrawlerHost()
  await crawlerHost.init()
  const url = "https://mp.weixin.qq.com/s/zzNSI5HV4LHy1f8--5-OOA"
  let result = await crawlerHost.crawl(url)
  console.log(result?.content)
  await crawlerHost.close()
  return
}
crawler()

```