---
name: web-search-skill
description: Search the web for current information, news, facts, and real-time data that may not be in your training data.
allowed-tools: web_search
metadata:
  author: machina
  version: "1.0"
  category: search
  icon: "🔍"
  color: "#bd93f9"
---

# Web Search Skill

This skill enables you to search the web for current, up-to-date information.

## How It Works

This skill provides instructions and context. To execute web searches, connect the **Web Search Tool** node to the Zeenie's `input-tools` handle.

## web_search Tool

Search the web and get relevant results.

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | The search query to look up on the web |

### Examples

**Basic search:**
```json
{
  "query": "latest news about artificial intelligence"
}
```

**Factual search:**
```json
{
  "query": "population of Tokyo 2024"
}
```

**Current events:**
```json
{
  "query": "weather forecast New York today"
}
```

**Technical search:**
```json
{
  "query": "how to use Python asyncio gather"
}
```

### Response Format

```json
{
  "query": "artificial intelligence news",
  "results": [
    {
      "title": "AI Breakthrough in Medical Research",
      "snippet": "Researchers have developed a new AI model that can predict...",
      "url": "https://example.com/ai-medical-research"
    },
    {
      "title": "OpenAI Announces New Model",
      "snippet": "The company revealed its latest advancement in...",
      "url": "https://example.com/openai-announcement"
    }
  ],
  "provider": "duckduckgo"
}
```

## When to Use Web Search

Use web search when the user asks about:

1. **Current events and news** - Recent happenings, breaking news, current affairs
2. **Real-time data** - Stock prices, weather, sports scores, exchange rates
3. **Recent information** - Events, releases, or changes after your knowledge cutoff
4. **Specific facts** - Population, statistics, dates that may have changed
5. **Technical documentation** - Latest API docs, library versions, tutorials
6. **Local information** - Business hours, addresses, phone numbers
7. **Product information** - Prices, availability, reviews

## When NOT to Use Web Search

Avoid searching when:

1. **General knowledge** - Well-established facts that won't change
2. **Simple calculations** - Use the calculator tool instead
3. **Creative tasks** - Writing, brainstorming, analysis
4. **Personal advice** - Relationship, life decisions
5. **Subjective opinions** - Preferences, recommendations without factual basis

## Search Query Best Practices

### Do:
- Use specific, focused queries
- Include relevant keywords
- Add context like dates, locations, or names
- Break complex questions into simpler searches

### Don't:
- Use overly long queries (keep under 10 words when possible)
- Include unnecessary words like "please" or "can you tell me"
- Ask questions as full sentences (use keywords instead)

### Examples of Good vs Bad Queries

| Bad Query | Good Query |
|-----------|------------|
| "Can you please tell me what the weather is like in London today?" | "London weather today" |
| "I want to know about the latest iPhone model and its features" | "iPhone 15 Pro specifications" |
| "What is happening in the stock market right now?" | "stock market news today" |

## Handling Results

1. **Summarize** the key findings from search results
2. **Cite sources** when providing specific information
3. **Indicate uncertainty** if results are conflicting or unclear
4. **Suggest follow-up searches** if the initial results are insufficient
5. **Combine multiple searches** for comprehensive answers

## Provider Information

The Web Search Tool supports multiple providers:

| Provider | API Key Required | Notes |
|----------|-----------------|-------|
| DuckDuckGo | No | Free, privacy-focused, good general results |
| Serper API | Yes | Google-powered, high quality, requires API key |
| Google Custom Search | Yes | Direct Google results, requires setup |

The default provider (DuckDuckGo) works without any API key.

## Limitations

- Results depend on the search provider's index
- Some recent events may not be indexed immediately
- Paywalled content may show limited snippets
- Results are in English by default

## Setup Requirements

1. Connect this skill to Zeenie's `input-skill` handle
2. Connect the Web Search Tool node to Zeenie's `input-tools` handle
3. (Optional) Configure API key in the tool node for Serper or Google
