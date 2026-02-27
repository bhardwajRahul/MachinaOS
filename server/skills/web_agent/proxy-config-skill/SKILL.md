---
name: proxy-config-skill
description: Configure any residential proxy provider using template-driven URL encoding. Generate url_template JSON from provider docs, save providers, set credentials, manage routing rules.
allowed-tools: proxy_config python_code
metadata:
  author: machina
  version: "1.0"
  category: integration
  icon: "🛡"
  color: "#8B5CF6"
---

# Proxy Config Skill

Configure any residential proxy provider in the world using the template-driven proxy system. No provider-specific code exists -- you generate a `url_template` JSON config that tells the system how to format proxy URLs for that provider.

## How It Works

1. User tells you which proxy provider they want to configure
2. You use `python_code` to generate and validate the `url_template` JSON
3. You use `proxy_config` to save the provider, set credentials, and optionally add routing rules
4. You use `proxy_config(test_provider)` to verify the setup works

## Tools

- **proxy_config** -- Manage providers, credentials, and routing rules
- **python_code** -- Generate and validate url_template JSON configs

---

## url_template JSON Schema

The `url_template` is a JSON object that tells the proxy system how to encode geo-targeting, session, and other parameters into the proxy URL. Every residential proxy provider uses one of three encoding strategies.

### Encoding Strategies (param_field)

| Strategy | param_field | How it works | Providers using this |
|----------|-------------|--------------|---------------------|
| Username encoding | `"username"` | Parameters appended to username string | ~80% of providers |
| Password encoding | `"password"` | Parameters appended to password string | A few providers |
| No encoding | `"none"` | Plain credentials, no parameter encoding | Generic/custom setups |

### Template Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `param_field` | string | `"username"` | Where to encode params: `"username"`, `"password"`, or `"none"` |
| `username_prefix` | string | `"{username}"` | Template for the username base. `{username}` is replaced with the actual username |
| `username_param_separator` | string | `"-"` | Separator between username prefix and first parameter |
| `param_separator` | string | `"-"` | Separator between individual parameters |
| `param_keys` | object | `{}` | Map of parameter names to format strings. `{v}` is replaced with the value |
| `country_case` | string | `"lower"` | Case for country codes: `"lower"` or `"upper"` |
| `city_separator` | string | `"_"` | Character replacing spaces in city/state names |

### param_keys Reference

| Key | Purpose | Example format string |
|-----|---------|----------------------|
| `country` | ISO country code | `"country-{v}"`, `"_country-{v}"`, `"cc-{v}"` |
| `state` | State/region | `"state-{v}"`, `"_state-{v}"` |
| `city` | City name | `"city-{v}"`, `"_city-{v}"` |
| `session_id` | Sticky session ID | `"session-{v}"`, `"sessid-{v}"` |
| `session_duration` | Session duration | `"sessTime-{v}"`, `"_lifetime-{v}"` |

### How URL Formatting Works

Given credentials `user123` / `pass456`, host `gate.example.com:7777`, country `US`:

**Username encoding** (`param_field: "username"`):
```
http://user123-country-us:pass456@gate.example.com:7777
      ^^^^^^^^^^^^^^^^^^^^^^^
      prefix + separator + params
```

**Password encoding** (`param_field: "password"`):
```
http://user123:pass456country-us@gate.example.com:7777
               ^^^^^^^^^^^^^^^^^^^^^
               password + params (no separator usually)
```

**No encoding** (`param_field: "none"`):
```
http://user123:pass456@gate.example.com:7777
```

---

## Workflow: Configure a New Provider

### Step 1: Generate url_template with python_code

Read the provider's documentation to identify:
1. What the proxy gateway host and port are
2. How parameters are encoded (username-based or password-based)
3. What separator characters are used
4. What the parameter format strings look like

Then use `python_code` to generate and validate the template:

```python
import json

# Build the url_template based on provider docs
template = {
    "param_field": "username",
    "username_prefix": "{username}",
    "username_param_separator": "-",
    "param_separator": "-",
    "param_keys": {
        "country": "country-{v}",
        "city": "city-{v}",
        "session_id": "session-{v}",
        "session_duration": "sessTime-{v}"
    },
    "country_case": "lower",
    "city_separator": "_"
}

# Validate: simulate what the proxy system does
username = "testuser"
password = "testpass"
country = "us"
city = "new_york"
session_id = "abc123"

params = []
if "country" in template["param_keys"]:
    cc = country.lower() if template.get("country_case") == "lower" else country.upper()
    params.append(template["param_keys"]["country"].replace("{v}", cc))
if "city" in template["param_keys"]:
    c = city.lower().replace(" ", template.get("city_separator", "_"))
    params.append(template["param_keys"]["city"].replace("{v}", c))
if "session_id" in template["param_keys"]:
    params.append(template["param_keys"]["session_id"].replace("{v}", session_id))

param_str = template.get("param_separator", "-").join(params)
prefix = template.get("username_prefix", "{username}").replace("{username}", username)

if template["param_field"] == "username" and param_str:
    sep = template.get("username_param_separator", "-")
    final_user = f"{prefix}{sep}{param_str}"
    final_pass = password
elif template["param_field"] == "password" and param_str:
    final_user = prefix
    final_pass = f"{password}{param_str}"
else:
    final_user = prefix
    final_pass = password

url = f"http://{final_user}:{final_pass}@gate.example.com:7777"
print(f"Generated URL: {url}")

# Assert the URL matches expected format from provider docs
assert "country-us" in url, "Country encoding failed"
assert "city-new_york" in url, "City encoding failed"
assert "session-abc123" in url, "Session encoding failed"

# Output the validated template
result = json.dumps(template, indent=2)
print(f"\nValidated template:\n{result}")
output = result
```

### Step 2: Save the provider with proxy_config

```json
{
  "operation": "add_provider",
  "name": "my_provider",
  "gateway_host": "gate.example.com",
  "gateway_port": 7777,
  "url_template": "{...the JSON template from step 1...}",
  "cost_per_gb": 2.50,
  "enabled": true,
  "priority": 50
}
```

### Step 3: Set credentials

```json
{
  "operation": "set_credentials",
  "name": "my_provider",
  "username": "actual_username",
  "password": "actual_password"
}
```

### Step 4: Test the provider

```json
{
  "operation": "test_provider",
  "name": "my_provider"
}
```

Expected response:
```json
{
  "success": true,
  "ip": "203.0.113.42",
  "latency_ms": 1250.3,
  "status_code": 200
}
```

### Step 5 (Optional): Add routing rules

Route specific domains through specific providers:

```json
{
  "operation": "add_routing_rule",
  "domain_pattern": "*.linkedin.com",
  "preferred_providers": "[\"my_provider\"]",
  "required_country": "US",
  "session_type": "sticky"
}
```

---

## proxy_config Tool Reference

### Operations

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `list_providers` | List all configured providers | (none) |
| `add_provider` | Add a new provider | name, gateway_host, gateway_port, url_template |
| `update_provider` | Update provider settings | name, + fields to change |
| `remove_provider` | Remove a provider | name |
| `set_credentials` | Set provider username/password | name, username, password |
| `test_provider` | Health check via httpbin.org/ip | name |
| `get_stats` | Get usage statistics | (none) |
| `add_routing_rule` | Add domain routing rule | domain_pattern |
| `list_routing_rules` | List all routing rules | (none) |
| `remove_routing_rule` | Remove a routing rule | rule_id |

### add_provider Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `"add_provider"` |
| name | string | Yes | Unique provider name (e.g., `"smartproxy"`, `"brightdata"`) |
| gateway_host | string | Yes | Gateway hostname |
| gateway_port | integer | Yes | Gateway port |
| url_template | string | Yes | JSON string of template config |
| enabled | boolean | No | Active status (default: true) |
| priority | integer | No | Lower = preferred (default: 50) |
| cost_per_gb | float | No | USD per GB (default: 0) |
| geo_coverage | string | No | JSON array of ISO country codes |

### set_credentials Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `"set_credentials"` |
| name | string | Yes | Provider name |
| username | string | Yes | Proxy username from provider dashboard |
| password | string | Yes | Proxy password from provider dashboard |

### add_routing_rule Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `"add_routing_rule"` |
| domain_pattern | string | Yes | Glob pattern: `"*.example.com"`, `"*"` (catch-all) |
| preferred_providers | string | No | JSON array of provider names |
| required_country | string | No | ISO country code |
| session_type | string | No | `"rotating"` or `"sticky"` (default: rotating) |

---

## Reading Provider Documentation

When the user gives you a provider name or documentation URL, look for these patterns:

### What to Extract

1. **Gateway endpoint**: Usually formatted as `host:port` (e.g., `gate.smartproxy.com:7777`)
2. **Username format**: How parameters are appended (e.g., `user-country-us-session-abc123`)
3. **Separator characters**: Dash `-`, underscore `_`, dot `.`, or custom
4. **Parameter names**: What the provider calls country, city, session, etc.
5. **Country code format**: Lowercase `us` vs uppercase `US`

### Common Patterns to Recognize

**Pattern A: Dash-separated username params (most common)**
```
username: user-country-us-city-new_york-session-abc123
password: pass
```
Template: `param_field: "username"`, separators: `"-"`

**Pattern B: Underscore prefix params**
```
username: user_country-us_city-new_york_session-abc123
password: pass
```
Template: `username_param_separator: "_"`, keys use `"_country-{v}"`

**Pattern C: Password-based encoding**
```
username: user
password: pass_country-us_session-abc123
```
Template: `param_field: "password"`

**Pattern D: Custom prefix**
```
username: customer-user-zone-us
password: pass
```
Template: `username_prefix: "customer-{username}"`, keys: `"zone-{v}"`

### Validation Checklist

After generating a template, always verify with `python_code`:

1. Country code appears correctly in the URL
2. City names have spaces replaced with the right separator
3. Session IDs are properly formatted
4. The overall URL matches what the provider docs show
5. Both rotating (no session) and sticky (with session) modes work

---

## Examples

### Example: User says "Set up Smartproxy"

1. Generate template with `python_code`:
```python
import json
template = {
    "param_field": "username",
    "username_prefix": "{username}",
    "username_param_separator": "-",
    "param_separator": "-",
    "param_keys": {
        "country": "country-{v}",
        "city": "city-{v}",
        "state": "state-{v}",
        "session_id": "session-{v}",
        "session_duration": "sessTime-{v}"
    },
    "country_case": "lower",
    "city_separator": "_"
}
output = json.dumps(template)
```

2. Save: `proxy_config(add_provider, name="smartproxy", gateway_host="gate.smartproxy.com", gateway_port=7777, url_template=<template>, cost_per_gb=4.00)`
3. Credentials: `proxy_config(set_credentials, name="smartproxy", username="sp...", password="...")`
4. Test: `proxy_config(test_provider, name="smartproxy")`

### Example: User provides custom proxy docs

If the user pastes documentation showing:
```
Proxy: proxy.example.com:8080
Username: your_key
Password: your_secret_cc-US_city-NewYork_sess-12345
```

You identify: password-based encoding, underscore prefix, dash key-value separator.

```python
import json
template = {
    "param_field": "password",
    "username_prefix": "{username}",
    "param_separator": "_",
    "param_keys": {
        "country": "cc-{v}",
        "city": "city-{v}",
        "session_id": "sess-{v}"
    },
    "country_case": "upper",
    "city_separator": ""
}
output = json.dumps(template)
```

---

## Guidelines

1. **Always validate** the template with `python_code` before saving
2. **Always test** the provider after setting credentials
3. **Never hardcode** provider-specific logic -- the template handles everything
4. If the user does not know their credentials, tell them to find username/password in their proxy provider's dashboard
5. If test fails, check: credentials correct? Gateway host/port correct? Template encoding matches docs?
6. Cost per GB is optional but helps the system prefer cheaper providers
7. Priority lower = preferred; use 10-30 for primary, 50 for default, 70-90 for fallback
