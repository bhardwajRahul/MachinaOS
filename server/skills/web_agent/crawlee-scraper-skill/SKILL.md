---
name: crawlee-scraper-skill
description: Scrape web pages using Crawlee. Supports static HTML (BeautifulSoup) and JavaScript-rendered content (Playwright) with proxy support.
allowed-tools: web_scraper
metadata:
  author: machina
  version: "1.0"
  category: web
  icon: "🕷"
  color: "#00D1B2"
---

# Crawlee Web Scraper Skill

Scrape web pages to extract text content, links, and structured data. Uses the Crawlee library with BeautifulSoup for static pages and Playwright for JavaScript-rendered content.

## How It Works

Connect the **Web Scraper** node to an agent's `input-tools` handle.

## web_scraper Tool

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | URL to scrape (https://...) |
| crawlerType | string | No | `beautifulsoup` (static, fast), `playwright` (JS-rendered), `adaptive` (auto) |
| mode | string | No | `single` (one page) or `crawl` (follow links) |
| cssSelector | string | No | CSS selector to extract specific content |
| maxPages | integer | No | Max pages for crawl mode (default: 10) |
| outputFormat | string | No | `text`, `html`, or `markdown` |
| useProxy | boolean | No | Route through configured proxy |

### When to Use Each Crawler Type

| Type | Use Case | Speed |
|------|----------|-------|
| `beautifulsoup` | Static HTML pages, blogs, documentation, news articles | Fast |
| `playwright` | SPAs, React/Vue apps, pages with lazy-loaded content | Slower |
| `adaptive` | Unknown pages, auto-detects if JS rendering needed | Medium |

### Response Format

```json
{
  "pages": [
    {
      "url": "https://example.com",
      "title": "Example Page",
      "content": "Extracted text content...",
      "links": ["https://example.com/page2"],
      "screenshot": "base64-encoded-png (playwright only)"
    }
  ],
  "page_count": 1,
  "crawler_type": "beautifulsoup",
  "mode": "single",
  "proxied": false
}
```

### Examples

**Scrape a single page:**
```json
{
  "url": "https://example.com/article",
  "crawlerType": "beautifulsoup",
  "outputFormat": "text"
}
```

**Scrape a JS-rendered SPA:**
```json
{
  "url": "https://app.example.com/dashboard",
  "crawlerType": "playwright"
}
```

**Crawl documentation site:**
```json
{
  "url": "https://docs.example.com",
  "mode": "crawl",
  "maxPages": 50,
  "outputFormat": "markdown"
}
```

**Extract specific content with CSS selector:**
```json
{
  "url": "https://blog.example.com",
  "cssSelector": "article .post-content",
  "outputFormat": "text"
}
```

**Scrape through proxy:**
```json
{
  "url": "https://example.com",
  "useProxy": true,
  "crawlerType": "beautifulsoup"
}
```

## Guidelines

1. **Start with beautifulsoup** - it is much faster. Only use playwright when content is JS-rendered.
2. **Use CSS selectors** to extract specific content instead of scraping entire pages.
3. **Set reasonable maxPages** when crawling to avoid excessive scraping.
4. **Use proxy** for sites that rate-limit or geo-restrict.
5. **Respect robots.txt** and website terms of service.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| "Crawlee not installed" | Missing dependency | `pip install 'crawlee[beautifulsoup]'` |
| "Playwright not installed" | Missing browser | `pip install 'crawlee[playwright]' && playwright install chromium` |
| Timeout | Page too slow or too many pages | Reduce maxPages or increase timeout |
| Empty content | Wrong CSS selector or JS-only page | Try playwright or adjust cssSelector |

## Setup

1. Connect **Web Scraper** node to agent's `input-tools` handle
2. BeautifulSoup works immediately (no extra setup)
3. For Playwright: `pip install 'crawlee[playwright]' && playwright install chromium`
4. For proxy: Configure proxy providers in Credentials Modal
