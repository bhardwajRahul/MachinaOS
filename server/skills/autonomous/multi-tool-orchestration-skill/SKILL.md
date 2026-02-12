---
name: multi-tool-orchestration-skill
description: Coordinate multiple tools together for complex multi-step tasks
allowed-tools: delegate_to_ai_agent python_code javascript_code web_search http_request calculator current_time
metadata:
  author: machina
  version: "1.0"
  category: autonomous
  icon: "🔀"
  color: "#6366F1"
---
# Multi-Tool Orchestration Pattern

You are an agent skilled at coordinating multiple tools together to accomplish complex tasks that require combining different capabilities.

## Why Multi-Tool Orchestration?

Complex real-world tasks often require multiple tools working together:
- **Data gathering** (web_search, http_request) + **Processing** (python_code) + **Delivery** (whatsapp_send)
- **Time awareness** (current_time) + **Calculation** (calculator) + **Scheduling** (scheduler)
- **Location** (gmaps) + **Communication** (social_send) + **Memory** (memory)

## Orchestration Patterns

### Pattern 1: Sequential Pipeline

Tools execute in order, each passing results to the next:

```
┌─────────────────────────────────────────────────────────────┐
│              SEQUENTIAL PIPELINE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [web_search] ──▶ [python_code] ──▶ [whatsapp_send]       │
│       │                │                   │                │
│       │                │                   │                │
│   "Find stock      "Calculate         "Send summary        │
│    prices"          average"           to user"            │
│       │                │                   │                │
│       ▼                ▼                   ▼                │
│   Raw data ──────▶ Processed ──────▶ Delivered             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Example: Stock Price Alert

**Task**: "Get the current prices of AAPL, GOOGL, and MSFT, calculate the average, and send me a WhatsApp message with the results"

**Orchestration Steps:**

1. **Gather Data** (web_search):
```json
{"tool": "web_search", "query": "AAPL GOOGL MSFT stock price today"}
```

2. **Process Data** (python_code):
```python
import json

# Data from previous step
prices = {"AAPL": 185.50, "GOOGL": 141.25, "MSFT": 378.90}

# Calculate statistics
average = sum(prices.values()) / len(prices)
highest = max(prices.items(), key=lambda x: x[1])
lowest = min(prices.items(), key=lambda x: x[1])

output = {
    "prices": prices,
    "average": round(average, 2),
    "highest": {"symbol": highest[0], "price": highest[1]},
    "lowest": {"symbol": lowest[0], "price": lowest[1]},
    "summary": f"Average: ${average:.2f} | High: {highest[0]} | Low: {lowest[0]}"
}
print(json.dumps(output, indent=2))
```

3. **Deliver Result** (whatsapp_send):
```json
{
  "tool": "whatsapp_send",
  "recipient": "user",
  "message": "Stock Update:\n- AAPL: $185.50\n- GOOGL: $141.25\n- MSFT: $378.90\n\nAverage: $235.22"
}
```

### Pattern 2: Parallel Gather, Sequential Process

Gather data from multiple sources simultaneously, then process together:

```
┌─────────────────────────────────────────────────────────────┐
│           PARALLEL GATHER + SEQUENTIAL PROCESS               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [web_search: weather] ──────┐                             │
│                               │                              │
│   [web_search: news] ─────────┼──▶ [python_code] ──▶ Output │
│                               │     "Combine &               │
│   [current_time] ─────────────┘      Format"                │
│                                                              │
│   All three run independently, results combined             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Example: Daily Briefing

**Task**: "Create a morning briefing with weather, top news, and today's schedule"

**Orchestration:**

```python
import json
from datetime import datetime

# Results from parallel tool calls (simulated)
weather_data = {"temp": 72, "condition": "Sunny", "high": 78, "low": 65}
news_data = [
    {"title": "Tech stocks rally", "source": "Reuters"},
    {"title": "New AI breakthrough", "source": "TechCrunch"}
]
current_time = datetime.now()

# Combine into briefing
briefing = {
    "date": current_time.strftime("%A, %B %d, %Y"),
    "time": current_time.strftime("%I:%M %p"),
    "weather": {
        "summary": f"{weather_data['condition']}, {weather_data['temp']}F",
        "range": f"High: {weather_data['high']}F, Low: {weather_data['low']}F"
    },
    "news": [f"- {n['title']} ({n['source']})" for n in news_data],
    "formatted": None
}

# Create formatted output
briefing["formatted"] = f"""
Good Morning! {briefing['date']}

WEATHER
{briefing['weather']['summary']}
{briefing['weather']['range']}

TOP NEWS
{chr(10).join(briefing['news'])}
"""

print(json.dumps(briefing, indent=2))
```

### Pattern 3: Conditional Branching

Choose different tools based on intermediate results:

```
┌─────────────────────────────────────────────────────────────┐
│              CONDITIONAL BRANCHING                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    [initial_check]                          │
│                          │                                   │
│              ┌───────────┼───────────┐                      │
│              ▼           ▼           ▼                      │
│         Condition A  Condition B  Condition C               │
│              │           │           │                      │
│              ▼           ▼           ▼                      │
│         [tool_A]     [tool_B]    [tool_C]                  │
│              │           │           │                      │
│              └───────────┼───────────┘                      │
│                          ▼                                   │
│                    [final_tool]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Example: Smart Communication

**Task**: "Contact John with the meeting update - use the best available channel"

**Orchestration Logic:**
```
1. CHECK availability:
   - Is John online on WhatsApp? → Use whatsapp_send
   - Is John's email available? → Use email (via http_request)
   - Neither? → Schedule reminder for later

2. EXECUTE chosen channel

3. CONFIRM delivery status
```

### Pattern 4: Iterative Refinement

Use tool results to improve subsequent tool calls:

```
┌─────────────────────────────────────────────────────────────┐
│              ITERATIVE REFINEMENT                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [web_search v1] ──▶ [python_code: analyze]                │
│         │                      │                             │
│         │              "Results incomplete"                  │
│         │                      │                             │
│         │                      ▼                             │
│         │            [web_search v2]                        │
│         │            (refined query)                        │
│         │                      │                             │
│         │              "Results better"                      │
│         │                      │                             │
│         └──────────────────────┼──▶ [python_code: combine]  │
│                                │                             │
│                                ▼                             │
│                          Final Result                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Example: Research Task

**Task**: "Find comprehensive information about quantum computing applications in finance"

**Iteration 1:**
```json
{"tool": "web_search", "query": "quantum computing finance applications"}
```
Result: General overview, but missing specific use cases

**Iteration 2 (refined):**
```json
{"tool": "web_search", "query": "quantum computing portfolio optimization risk analysis"}
```
Result: Specific applications found

**Combine with Code:**
```python
import json

# Results from both searches
search_1 = ["Overview of quantum finance", "Major players"]
search_2 = ["Portfolio optimization algorithms", "Risk modeling with qubits"]

combined = {
    "topic": "Quantum Computing in Finance",
    "general": search_1,
    "specific_applications": search_2,
    "summary": "Quantum computing in finance focuses on portfolio optimization and risk analysis..."
}
print(json.dumps(combined, indent=2))
```

## Complex Multi-Tool Examples

### Example 1: Travel Planning Assistant

**Task**: "Plan a trip from New York to San Francisco next week, find hotels, and send me an itinerary"

**Tools Used**: `current_time`, `web_search`, `python_code`, `whatsapp_send`

**Orchestration:**

```
Step 1: Get current date (current_time)
        ↓
Step 2: Calculate "next week" dates (python_code)
        ↓
Step 3: Search for flights (web_search: "NYC to SFO flights [dates]")
        ↓
Step 4: Search for hotels (web_search: "San Francisco hotels [dates]")
        ↓
Step 5: Combine and format itinerary (python_code)
        ↓
Step 6: Send to user (whatsapp_send)
```

**Code for Step 5:**
```python
import json
from datetime import datetime, timedelta

# Inputs from previous steps
today = datetime.now()
trip_start = today + timedelta(days=7)
trip_end = trip_start + timedelta(days=3)

flights = [
    {"airline": "United", "departure": "8:00 AM", "price": "$350"},
    {"airline": "Delta", "departure": "11:30 AM", "price": "$380"}
]

hotels = [
    {"name": "Marriott Union Square", "price": "$250/night", "rating": 4.5},
    {"name": "Hilton Financial District", "price": "$280/night", "rating": 4.3}
]

itinerary = {
    "trip": {
        "from": "New York (JFK)",
        "to": "San Francisco (SFO)",
        "dates": f"{trip_start.strftime('%b %d')} - {trip_end.strftime('%b %d, %Y')}"
    },
    "recommended_flight": flights[0],
    "recommended_hotel": hotels[0],
    "estimated_total": "$1,100",
    "formatted_message": f"""
Travel Itinerary: NYC → SFO

DATES
{trip_start.strftime('%b %d')} - {trip_end.strftime('%b %d, %Y')}

FLIGHT (Recommended)
{flights[0]['airline']} - {flights[0]['departure']} - {flights[0]['price']}

HOTEL (Recommended)
{hotels[0]['name']}
{hotels[0]['price']} | Rating: {hotels[0]['rating']}/5

ESTIMATED TOTAL: $1,100
"""
}

print(json.dumps(itinerary, indent=2))
```

### Example 2: Automated Report Generation

**Task**: "Generate a weekly sales report with charts and email it to the team"

**Tools Used**: `http_request` (API), `python_code`, `http_request` (email)

**Orchestration:**

```
Step 1: Fetch sales data from API (http_request)
        ↓
Step 2: Process and analyze data (python_code)
        ↓
Step 3: Generate text summary (python_code)
        ↓
Step 4: Format as HTML report (python_code)
        ↓
Step 5: Send via email API (http_request)
```

### Example 3: Smart Home Automation

**Task**: "When I get home, turn on the lights, set temperature to 72F, and play my evening playlist"

**Tools Used**: `location`, `http_request` (smart home API), `python_code`

**Orchestration:**

```
Step 1: Check current location (location tool)
        ↓
Step 2: Calculate distance to home (python_code)
        ↓
Step 3: If within 1 mile:
        ├── Turn on lights (http_request to smart home API)
        ├── Set thermostat (http_request to smart home API)
        └── Start playlist (http_request to music API)
        ↓
Step 4: Confirm all actions (python_code)
```

## Orchestration with Delegation

For complex multi-tool tasks, delegate sub-tasks to yourself:

```json
{
  "task": "Continue: Execute delivery phase of travel planning",
  "context": "Iteration: 3/4
Previous: Gathered flight and hotel data
Current state: Itinerary formatted and ready
Data: {flight: United $350, hotel: Marriott $250/night}
Next: Send itinerary via WhatsApp and confirm delivery"
}
```

## Tool Combination Matrix

| Task Type | Primary Tools | Supporting Tools |
|-----------|--------------|------------------|
| **Research** | web_search, http_request | python_code (analysis) |
| **Calculation** | calculator, python_code | current_time |
| **Communication** | whatsapp_send, http_request | python_code (formatting) |
| **Scheduling** | current_time, calculator | python_code (date math) |
| **Data Processing** | python_code, javascript_code | http_request (APIs) |
| **Location-based** | gmaps, location | python_code, whatsapp_send |

## Best Practices

### 1. Plan Before Executing
```
Before calling tools, outline:
1. What data do I need?
2. What tools provide that data?
3. What order should they run?
4. How will results combine?
```

### 2. Minimize Tool Calls
```
BAD:  web_search("AAPL price") → web_search("GOOGL price") → web_search("MSFT price")
GOOD: web_search("AAPL GOOGL MSFT stock prices today")
```

### 3. Use Code for Complex Logic
```
Instead of multiple calculator calls:
calculator(10 * 5) → calculator(50 + 20) → calculator(70 / 2)

Use python_code:
result = ((10 * 5) + 20) / 2  # Single execution
```

### 4. Pass Context Between Tools
```
Tool 1 output: {"temperature": 72, "unit": "F"}
Tool 2 input: Use the temperature (72F) in the message
```

### 5. Handle Partial Failures
```
If tool 2 of 4 fails:
- Continue with remaining tools if possible
- Use partial data from successful tools
- Report what succeeded and what failed
```

## Anti-Patterns

### 1. Serial When Parallel is Possible
```
// Unnecessary waiting
await web_search("weather")
await web_search("news")     // Could run in parallel
await web_search("stocks")   // Could run in parallel
```

### 2. Over-Orchestration
```
// Don't use 5 tools when 1 suffices
Task: "What's 2 + 2?"
BAD:  current_time → python_code → calculator → format → return
GOOD: calculator(2 + 2) or just respond "4"
```

### 3. Ignoring Tool Results
```
// Always use the actual results
BAD:  Call web_search, ignore result, make up answer
GOOD: Call web_search, process result, return based on actual data
```
