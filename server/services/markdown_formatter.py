"""Platform-specific markdown formatting using markdown-it-py.

Converts GFM-style markdown (as produced by LLMs) to platform-native formats:
- Telegram HTML: render to HTML, convert unsupported tags
- WhatsApp: walk token stream, map to WhatsApp-native syntax
- Plain text: strip all formatting
"""

import re
from markdown_it import MarkdownIt


_md = MarkdownIt("commonmark", {"breaks": True}).enable("strikethrough")

# Tags Telegram supports natively in HTML parse mode
_TELEGRAM_SUPPORTED = {"b", "strong", "i", "em", "s", "strike", "del", "code", "pre", "a", "blockquote", "u", "tg-spoiler", "tg-emoji"}


def to_telegram_html(text: str) -> str:
    """Convert GFM markdown to Telegram-compatible HTML.

    Telegram HTML supports: <b>, <i>, <s>, <code>, <pre>, <a>, <blockquote>, <u>.
    Unsupported tags are converted: <h1>-<h6> -> <b>, <ul>/<ol>/<li> -> bullet text, <p> -> stripped.
    """
    if not text or not text.strip():
        return text

    html = _md.render(text).strip()

    # Convert headings to bold
    html = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"<b>\1</b>", html, flags=re.DOTALL)

    # Convert list items to bullet lines
    html = re.sub(r"<li>(.*?)</li>", r"  - \1", html, flags=re.DOTALL)
    html = re.sub(r"</?[ou]l>", "", html)

    # Strip <p> tags, replace closing </p> with double newline
    html = re.sub(r"<p>", "", html)
    html = re.sub(r"</p>", "\n", html)

    # Strip <hr> tags
    html = re.sub(r"<hr\s*/?>", "", html)

    # Clean up blockquote inner whitespace
    html = re.sub(r"<blockquote>\s*\n*", "<blockquote>", html)
    html = re.sub(r"\s*\n*</blockquote>", "</blockquote>", html)

    # Map <strong> -> <b>, <em> -> <i>, <del>/<strike> -> <s> for consistency
    html = html.replace("<strong>", "<b>").replace("</strong>", "</b>")
    html = html.replace("<em>", "<i>").replace("</em>", "</i>")
    html = html.replace("<del>", "<s>").replace("</del>", "</s>")
    html = html.replace("<strike>", "<s>").replace("</strike>", "</s>")

    # Collapse multiple newlines
    html = re.sub(r"\n{3,}", "\n\n", html)
    return html.strip()


def to_whatsapp(text: str) -> str:
    """Convert GFM markdown to WhatsApp-native formatting.

    WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```code```, > quote (single line).
    """
    if not text or not text.strip():
        return text

    tokens = _md.parse(text)
    result = []
    _walk_tokens(tokens, result)
    output = "".join(result)
    # Collapse excessive newlines
    output = re.sub(r"\n{3,}", "\n\n", output)
    return output.strip()


def _walk_tokens(tokens: list, result: list, depth: int = 0) -> None:
    """Walk markdown-it token stream and emit WhatsApp-formatted text."""
    in_list = False
    in_blockquote = False
    i = 0
    while i < len(tokens):
        token = tokens[i]
        ttype = token.type

        if ttype == "inline" and token.children:
            _walk_tokens(token.children, result, depth)
        elif ttype == "text":
            result.append(token.content)
        elif ttype == "code_inline":
            result.append(f"`{token.content}`")
        elif ttype == "softbreak":
            result.append("\n")
        elif ttype == "hardbreak":
            result.append("\n")
        elif ttype == "fence":
            result.append(f"```{token.content}```")
        elif ttype == "code_block":
            result.append(f"```{token.content}```")
        elif ttype in ("strong_open", "bold_open"):
            result.append("*")
        elif ttype in ("strong_close", "bold_close"):
            result.append("*")
        elif ttype in ("em_open", "emphasis_open"):
            result.append("_")
        elif ttype in ("em_close", "emphasis_close"):
            result.append("_")
        elif ttype in ("s_open",):
            result.append("~")
        elif ttype in ("s_close",):
            result.append("~")
        elif ttype == "paragraph_open":
            # Suppress paragraph newline inside list items and blockquotes
            if not in_list and not in_blockquote and i > 0:
                result.append("\n")
        elif ttype == "paragraph_close":
            if not in_list and not in_blockquote:
                result.append("\n")
        elif ttype == "heading_open":
            if i > 0:
                result.append("\n")
            result.append("*")
        elif ttype == "heading_close":
            result.append("*\n")
        elif ttype in ("bullet_list_open", "ordered_list_open"):
            in_list = True
        elif ttype in ("bullet_list_close", "ordered_list_close"):
            in_list = False
        elif ttype == "list_item_open":
            result.append("  - " if depth == 0 else "    - ")
        elif ttype == "list_item_close":
            if not result or not result[-1].endswith("\n"):
                result.append("\n")
        elif ttype == "blockquote_open":
            in_blockquote = True
            result.append("> ")
        elif ttype == "blockquote_close":
            in_blockquote = False
            result.append("\n")
        elif ttype == "hr":
            result.append("\n---\n")
        elif ttype == "link_open":
            pass  # WhatsApp auto-links URLs
        elif ttype == "link_close":
            href = None
            for j in range(i - 1, -1, -1):
                if tokens[j].type == "link_open":
                    href = tokens[j].attrGet("href")
                    break
            if href:
                result.append(f" ({href})")
        elif ttype == "image":
            alt = token.content or token.attrGet("alt") or "image"
            src = token.attrGet("src") or ""
            result.append(f"[{alt}]({src})")
        elif ttype == "html_block" or ttype == "html_inline":
            result.append(token.content)

        i += 1


def to_plain(text: str) -> str:
    """Strip all markdown formatting, return plain text."""
    if not text or not text.strip():
        return text

    html = _md.render(text)
    # Strip all HTML tags
    plain = re.sub(r"<[^>]+>", "", html)
    plain = re.sub(r"\n{3,}", "\n\n", plain)
    return plain.strip()
