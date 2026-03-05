"""Twitter/X node handlers using official XDK SDK."""

import asyncio
import time
from typing import Dict, Any, List
from xdk import Client

from core.logging import get_logger
from services.pricing import get_pricing_service

logger = get_logger(__name__)


async def _track_twitter_usage(
    node_id: str,
    action: str,
    resource_count: int = 1,
    workflow_id: str = None,
    session_id: str = "default"
) -> Dict[str, float]:
    """Track Twitter API usage for cost calculation.

    Args:
        node_id: The node executing the Twitter action
        action: Action name (tweet, search, followers, etc.)
        resource_count: Number of resources fetched (for paginated results)
        workflow_id: Optional workflow context
        session_id: Session for aggregation

    Returns:
        Cost breakdown dict with operation, unit_cost, resource_count, total_cost
    """
    from core.container import container

    pricing = get_pricing_service()
    cost_data = pricing.calculate_api_cost('twitter', action, resource_count)

    # Save to database
    db = container.database()
    await db.save_api_usage_metric({
        'session_id': session_id,
        'node_id': node_id,
        'workflow_id': workflow_id,
        'service': 'twitter',
        'operation': cost_data.get('operation', action),
        'endpoint': action,
        'resource_count': resource_count,
        'cost': cost_data.get('total_cost', 0.0)
    })

    logger.debug(f"[Twitter] Tracked usage: {action} x{resource_count} = ${cost_data.get('total_cost', 0):.6f}")
    return cost_data


def _is_auth_error(e: Exception) -> bool:
    """Check if exception indicates an expired/invalid token."""
    s = str(e)
    return '401' in s or '403' in s or 'Unauthorized' in s or 'Forbidden' in s


async def _get_twitter_client() -> Client:
    """Get authenticated Twitter client from stored OAuth 2.0 credentials.

    No validation call -- saves rate limits. If the token is expired,
    the actual API call will fail and the handler retries via _refresh_and_get_client().
    """
    from core.container import container
    auth_service = container.auth_service()

    tokens = await auth_service.get_oauth_tokens("twitter", customer_id="owner")
    if not tokens or not tokens.get("access_token"):
        raise ValueError("Twitter not connected. Please authenticate via Credentials.")

    return Client(access_token=tokens["access_token"])


async def _refresh_and_get_client() -> Client:
    """Refresh expired token and return new client."""
    from core.container import container
    auth_service = container.auth_service()

    tokens = await auth_service.get_oauth_tokens("twitter", customer_id="owner")
    refresh_token = tokens.get("refresh_token", "") if tokens else ""

    if not refresh_token:
        raise ValueError("Twitter token expired. Please re-authenticate via Credentials.")

    from services.twitter_oauth import TwitterOAuth

    client_id = await auth_service.get_api_key("twitter_client_id") or ""
    client_secret = await auth_service.get_api_key("twitter_client_secret")

    oauth = TwitterOAuth(client_id=client_id, client_secret=client_secret, redirect_uri="")
    result = await oauth.refresh_access_token(refresh_token)

    if not result.get("success"):
        raise ValueError("Twitter token expired and refresh failed. Please re-authenticate.")

    new_access = result["access_token"]
    new_refresh = result.get("refresh_token", refresh_token)

    await auth_service.store_oauth_tokens(
        provider="twitter",
        access_token=new_access,
        refresh_token=new_refresh,
        email=tokens.get("email", ""),
        name=tokens.get("name", ""),
        scopes=tokens.get("scopes", ""),
        customer_id="owner",
    )

    logger.info("Twitter token refreshed successfully")
    return Client(access_token=new_access)


async def _get_my_user_id(client: Client) -> str:
    """Get the authenticated user's ID."""
    response = await asyncio.to_thread(client.users.get_me)
    # response.data is a dict with 'id', 'username', 'name' keys
    return response.data["id"]


# ---------------------------------------------------------------------------
# Sync helper functions for asyncio.to_thread (XDK uses requests internally)
# ---------------------------------------------------------------------------

def _sync_create_post(client: Client, payload: dict):
    return client.posts.create(body=payload)


def _sync_repost(client: Client, user_id: str, payload: dict):
    return client.users.repost_post(user_id, body=payload)


def _sync_like(client: Client, user_id: str, payload: dict):
    return client.users.like_post(user_id, body=payload)


def _sync_unlike(client: Client, user_id: str, tweet_id: str):
    return client.users.unlike_post(user_id, tweet_id=tweet_id)


def _sync_delete_post(client: Client, tweet_id: str):
    return client.posts.delete(tweet_id)


def _sync_search_recent(client: Client, query: str, max_results: int) -> dict:
    """Run search_recent synchronously, return first page data + includes.

    Returns dict with 'tweets' (raw tweet data) and 'includes' (expanded
    media/user/referenced_tweets objects) so callers can enrich output.
    """
    for page in client.posts.search_recent(
        query=query,
        max_results=max_results,
        tweet_fields=[
            "author_id", "created_at", "entities", "public_metrics",
            "possibly_sensitive", "lang", "source",
            "conversation_id", "in_reply_to_user_id", "referenced_tweets",
            "note_tweet",
        ],
        expansions=[
            "author_id",
            "attachments.media_keys",
            "referenced_tweets.id",
            "referenced_tweets.id.author_id",
        ],
        media_fields=["url", "preview_image_url", "type", "alt_text", "variants"],
        user_fields=["username", "name", "profile_image_url"],
    ):
        page_data = getattr(page, 'data', []) or []
        includes_raw = getattr(page, 'includes', None)
        includes_dict = {}
        if includes_raw:
            if hasattr(includes_raw, 'model_dump'):
                try:
                    includes_dict = includes_raw.model_dump()
                except Exception:
                    includes_dict = {}
            elif isinstance(includes_raw, dict):
                includes_dict = includes_raw
        return {"tweets": page_data, "includes": includes_dict}
    return {"tweets": [], "includes": {}}


def _sync_get_me(client: Client, user_fields: list = None):
    return client.users.get_me(user_fields=user_fields)


def _sync_get_by_usernames(client: Client, usernames: list, user_fields: list = None):
    return client.users.get_by_usernames(usernames=usernames, user_fields=user_fields)


def _sync_get_by_ids(client: Client, ids: list, user_fields: list = None):
    return client.users.get_by_ids(ids=ids, user_fields=user_fields)


def _sync_get_followers(client: Client, user_id: str, max_results: int) -> list:
    """Get first page of followers synchronously."""
    users = []
    for page in client.users.get_followers(
        user_id, max_results=max_results, user_fields=["created_at"]
    ):
        page_data = getattr(page, 'data', []) or []
        users.extend(page_data)
        break
    return users


def _sync_get_following(client: Client, user_id: str, max_results: int) -> list:
    """Get first page of following synchronously."""
    users = []
    for page in client.users.get_following(
        user_id, max_results=max_results, user_fields=["created_at"]
    ):
        page_data = getattr(page, 'data', []) or []
        users.extend(page_data)
        break
    return users


async def handle_twitter_send(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Twitter send actions: tweet, reply, retweet, like, unlike, delete."""
    start_time = time.time()
    action = parameters.get('action', 'tweet')

    try:
        client = await _get_twitter_client()

        # Extract workflow context for tracking
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        try:
            return await _do_twitter_send(client, action, parameters, node_id, workflow_id, session_id, start_time)
        except Exception as e:
            if _is_auth_error(e):
                logger.info(f"Twitter auth error, refreshing token: {e}")
                client = await _refresh_and_get_client()
                return await _do_twitter_send(client, action, parameters, node_id, workflow_id, session_id, start_time)
            raise

    except Exception as e:
        logger.error(f"Twitter send error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def _do_twitter_send(
    client: Client, action: str, parameters: Dict[str, Any],
    node_id: str, workflow_id: str, session_id: str, start_time: float
) -> Dict[str, Any]:
    """Execute a Twitter send action with the given client."""
    match action:
        case 'tweet':
            text = parameters.get('text', '')
            if not text:
                raise ValueError("Tweet text is required")
            payload = {"text": text[:280]}
            result = await asyncio.to_thread(_sync_create_post, client, payload)
            await _track_twitter_usage(node_id, 'tweet', 1, workflow_id, session_id)
            return _success(_format_response(result), "tweet_sent", start_time)

        case 'reply':
            text = parameters.get('text', '')
            reply_to = parameters.get('reply_to_id')
            if not text or not reply_to:
                raise ValueError("Text and reply_to_id are required")
            payload = {
                "text": text[:280],
                "reply": {"in_reply_to_tweet_id": reply_to}
            }
            result = await asyncio.to_thread(_sync_create_post, client, payload)
            await _track_twitter_usage(node_id, 'reply', 1, workflow_id, session_id)
            return _success(_format_response(result), "reply_sent", start_time)

        case 'retweet':
            tweet_id = parameters.get('tweet_id')
            if not tweet_id:
                raise ValueError("tweet_id is required")
            user_id = await _get_my_user_id(client)
            payload = {"tweet_id": tweet_id}
            result = await asyncio.to_thread(_sync_repost, client, user_id, payload)
            await _track_twitter_usage(node_id, 'retweet', 1, workflow_id, session_id)
            return _success(_format_response(result), "retweeted", start_time)

        case 'like':
            tweet_id = parameters.get('tweet_id')
            if not tweet_id:
                raise ValueError("tweet_id is required")
            user_id = await _get_my_user_id(client)
            payload = {"tweet_id": tweet_id}
            result = await asyncio.to_thread(_sync_like, client, user_id, payload)
            await _track_twitter_usage(node_id, 'like', 1, workflow_id, session_id)
            return _success(_format_response(result), "liked", start_time)

        case 'unlike':
            tweet_id = parameters.get('tweet_id')
            if not tweet_id:
                raise ValueError("tweet_id is required")
            user_id = await _get_my_user_id(client)
            result = await asyncio.to_thread(_sync_unlike, client, user_id, tweet_id)
            await _track_twitter_usage(node_id, 'unlike', 1, workflow_id, session_id)
            return _success(_format_response(result), "unliked", start_time)

        case 'delete':
            tweet_id = parameters.get('tweet_id')
            if not tweet_id:
                raise ValueError("tweet_id is required")
            result = await asyncio.to_thread(_sync_delete_post, client, tweet_id)
            await _track_twitter_usage(node_id, 'delete', 1, workflow_id, session_id)
            return _success(_format_response(result), "deleted", start_time)

        case _:
            raise ValueError(f"Unknown action: {action}")


async def handle_twitter_search(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Twitter search operations."""
    start_time = time.time()

    try:
        client = await _get_twitter_client()
        query = parameters.get('query', '')
        # X API v2 requires max_results between 10 and 100 for search/recent
        max_results = max(10, min(parameters.get('max_results', 10), 100))

        if not query:
            raise ValueError("Search query is required")

        # Extract workflow context for tracking
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        try:
            search_result = await asyncio.to_thread(_sync_search_recent, client, query, max_results)
        except Exception as e:
            if _is_auth_error(e):
                logger.info(f"Twitter auth error on search, refreshing token: {e}")
                client = await _refresh_and_get_client()
                search_result = await asyncio.to_thread(_sync_search_recent, client, query, max_results)
            else:
                raise

        raw_tweets = search_result["tweets"]
        includes = search_result["includes"]

        # Build lookup dicts from includes for enriching tweet data
        users_by_id = {}
        for u in (includes.get("users") or []):
            uid = u.get("id") if isinstance(u, dict) else getattr(u, "id", None)
            if uid:
                users_by_id[str(uid)] = u if isinstance(u, dict) else {
                    k: v for k, v in u.__dict__.items() if not k.startswith('_')
                }

        media_by_key = {}
        for m in (includes.get("media") or []):
            mk = m.get("media_key") if isinstance(m, dict) else getattr(m, "media_key", None)
            if mk:
                media_by_key[mk] = m if isinstance(m, dict) else {
                    k: v for k, v in m.__dict__.items() if not k.startswith('_')
                }

        tweets_by_id = {}
        for t in (includes.get("tweets") or []):
            tid = t.get("id") if isinstance(t, dict) else getattr(t, "id", None)
            if tid:
                tweets_by_id[str(tid)] = t if isinstance(t, dict) else {
                    k: v for k, v in t.__dict__.items() if not k.startswith('_')
                }

        tweets = [_format_tweet(t, users_by_id, media_by_key, tweets_by_id) for t in raw_tweets]

        # Track: posts_read $0.005 per tweet fetched
        if tweets:
            await _track_twitter_usage(node_id, 'search', len(tweets), workflow_id, session_id)

        return {
            "success": True,
            "result": {"tweets": tweets, "count": len(tweets), "query": query},
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        logger.error(f"Twitter search error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def handle_twitter_user(
    node_id: str,
    node_type: str,
    parameters: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Handle Twitter user lookup operations."""
    start_time = time.time()
    operation = parameters.get('operation', 'me')

    try:
        client = await _get_twitter_client()

        # Extract workflow context for tracking
        workflow_id = context.get('workflow_id')
        session_id = context.get('session_id', 'default')

        try:
            return await _do_twitter_user(client, operation, parameters, node_id, workflow_id, session_id, start_time)
        except Exception as e:
            if _is_auth_error(e):
                logger.info(f"Twitter auth error on user op, refreshing token: {e}")
                client = await _refresh_and_get_client()
                return await _do_twitter_user(client, operation, parameters, node_id, workflow_id, session_id, start_time)
            raise

    except Exception as e:
        logger.error(f"Twitter user error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


async def _do_twitter_user(
    client: Client, operation: str, parameters: Dict[str, Any],
    node_id: str, workflow_id: str, session_id: str, start_time: float
) -> Dict[str, Any]:
    """Execute a Twitter user operation with the given client."""
    match operation:
        case 'me':
            result = await asyncio.to_thread(_sync_get_me, client, ["created_at", "description"])
            await _track_twitter_usage(node_id, 'me', 1, workflow_id, session_id)
            return _success(_format_user_data(result.data), "user", start_time)

        case 'by_username':
            username = parameters.get('username')
            if not username:
                raise ValueError("Username is required")
            result = await asyncio.to_thread(
                _sync_get_by_usernames, client, [username], ["description", "created_at"]
            )
            users = getattr(result, 'data', []) or []
            if not users:
                raise ValueError(f"User @{username} not found")
            await _track_twitter_usage(node_id, 'by_username', 1, workflow_id, session_id)
            return _success(_format_user_data(users[0]), "user", start_time)

        case 'by_id':
            user_id = parameters.get('user_id')
            if not user_id:
                raise ValueError("User ID is required")
            result = await asyncio.to_thread(
                _sync_get_by_ids, client, [user_id], ["description", "created_at"]
            )
            users = getattr(result, 'data', []) or []
            if not users:
                raise ValueError(f"User ID {user_id} not found")
            await _track_twitter_usage(node_id, 'by_id', 1, workflow_id, session_id)
            return _success(_format_user_data(users[0]), "user", start_time)

        case 'followers':
            user_id = parameters.get('user_id')
            if not user_id:
                user_id = await _get_my_user_id(client)
            # X API requires max_results >= 1 for followers
            max_results = max(1, min(parameters.get('max_results', 100), 1000))
            raw_users = await asyncio.to_thread(_sync_get_followers, client, user_id, max_results)
            users = [_format_user_data(u) for u in raw_users]
            if users:
                await _track_twitter_usage(node_id, 'followers', len(users), workflow_id, session_id)
            return _success({"users": users, "count": len(users)}, "followers", start_time)

        case 'following':
            user_id = parameters.get('user_id')
            if not user_id:
                user_id = await _get_my_user_id(client)
            # X API requires max_results >= 1 for following
            max_results = max(1, min(parameters.get('max_results', 100), 1000))
            raw_users = await asyncio.to_thread(_sync_get_following, client, user_id, max_results)
            users = [_format_user_data(u) for u in raw_users]
            if users:
                await _track_twitter_usage(node_id, 'following', len(users), workflow_id, session_id)
            return _success({"users": users, "count": len(users)}, "following", start_time)

        case _:
            raise ValueError(f"Unknown operation: {operation}")


def _success(data: Any, action: str, start_time: float) -> Dict[str, Any]:
    """Build success response."""
    return {
        "success": True,
        "result": data if isinstance(data, dict) else {"data": data, "action": action},
        "execution_time": time.time() - start_time
    }


def _format_response(response) -> Dict[str, Any]:
    """Format XDK response object to dict."""
    if hasattr(response, 'data'):
        data = response.data
        if isinstance(data, dict):
            return data
        # Convert object attributes to dict
        return {k: v for k, v in data.__dict__.items() if not k.startswith('_')} if hasattr(data, '__dict__') else {"data": str(data)}
    return {"response": str(response)}


def _format_tweet(tweet, users_by_id: Dict = None, media_by_key: Dict = None,
                   tweets_by_id: Dict = None) -> Dict[str, Any]:
    """Format tweet object/dict to dict with enriched data from includes.

    Args:
        tweet: Raw tweet data (dict or object)
        users_by_id: {user_id: user_dict} from includes.users
        media_by_key: {media_key: media_dict} from includes.media
        tweets_by_id: {tweet_id: tweet_dict} from includes.tweets (referenced)
    """
    users_by_id = users_by_id or {}
    media_by_key = media_by_key or {}
    tweets_by_id = tweets_by_id or {}

    def _get(obj, key, default=None):
        return obj.get(key, default) if isinstance(obj, dict) else getattr(obj, key, default)

    tweet_id = _get(tweet, 'id')
    author_id = _get(tweet, 'author_id')
    text = _get(tweet, 'text', '')

    # Extract expanded URLs from entities to replace t.co links
    entities = _get(tweet, 'entities') or {}
    if isinstance(entities, dict):
        urls_list = entities.get('urls', [])
    elif hasattr(entities, 'urls'):
        urls_list = entities.urls or []
    else:
        urls_list = []

    expanded_urls = []
    display_text = text
    for u in urls_list:
        if isinstance(u, dict):
            short = u.get('url', '')
            expanded = u.get('expanded_url', '')
            display = u.get('display_url', '')
        else:
            short = getattr(u, 'url', '')
            expanded = getattr(u, 'expanded_url', '')
            display = getattr(u, 'display_url', '')
        if short and expanded:
            expanded_urls.append({"url": short, "expanded_url": expanded, "display_url": display})
            display_text = display_text.replace(short, expanded)

    # Note tweet (long-form tweets > 280 chars)
    note_tweet = _get(tweet, 'note_tweet')
    if note_tweet:
        note_text = note_tweet.get('text', '') if isinstance(note_tweet, dict) else getattr(note_tweet, 'text', '')
        if note_text:
            text = note_text
            display_text = note_text

    # Author info from includes
    author_info = users_by_id.get(str(author_id)) if author_id else None

    # Media from includes via attachments.media_keys
    attachments = _get(tweet, 'attachments') or {}
    if isinstance(attachments, dict):
        media_keys = attachments.get('media_keys', [])
    elif hasattr(attachments, 'media_keys'):
        media_keys = attachments.media_keys or []
    else:
        media_keys = []
    media_list = [media_by_key[k] for k in media_keys if k in media_by_key]

    # Referenced tweets (quoted, replied_to)
    ref_tweets_raw = _get(tweet, 'referenced_tweets') or []
    referenced = []
    for ref in ref_tweets_raw:
        if isinstance(ref, dict):
            ref_type = ref.get('type', '')
            ref_id = ref.get('id', '')
        else:
            ref_type = getattr(ref, 'type', '')
            ref_id = getattr(ref, 'id', '')
        ref_data = tweets_by_id.get(str(ref_id))
        referenced.append({
            "type": ref_type,
            "id": ref_id,
            "text": ref_data.get("text", "") if ref_data else None,
            "author_id": ref_data.get("author_id") if ref_data else None,
        })

    # Public metrics
    metrics = _get(tweet, 'public_metrics') or {}
    if not isinstance(metrics, dict) and hasattr(metrics, 'model_dump'):
        metrics = metrics.model_dump()
    elif not isinstance(metrics, dict):
        metrics = {}

    result = {
        "id": tweet_id,
        "text": text,
        "display_text": display_text,
        "author_id": author_id,
        "created_at": str(_get(tweet, 'created_at', '')),
        "lang": _get(tweet, 'lang'),
        "source": _get(tweet, 'source'),
        "conversation_id": _get(tweet, 'conversation_id'),
        "in_reply_to_user_id": _get(tweet, 'in_reply_to_user_id'),
        "possibly_sensitive": _get(tweet, 'possibly_sensitive', False),
        "public_metrics": metrics,
    }

    if author_info:
        result["author"] = author_info
    if expanded_urls:
        result["urls"] = expanded_urls
    if media_list:
        result["media"] = media_list
    if referenced:
        result["referenced_tweets"] = referenced

    return result


def _format_user_data(user) -> Dict[str, Any]:
    """Format user object/dict to dict."""
    if isinstance(user, dict):
        return {
            "id": user.get("id"),
            "username": user.get("username"),
            "name": user.get("name"),
            "profile_image_url": user.get("profile_image_url"),
            "verified": user.get("verified", False),
            "description": user.get("description"),
            "created_at": str(user.get("created_at", "")),
        }
    return {
        "id": getattr(user, 'id', None),
        "username": getattr(user, 'username', None),
        "name": getattr(user, 'name', None),
        "profile_image_url": getattr(user, 'profile_image_url', None),
        "verified": getattr(user, 'verified', False),
        "description": getattr(user, 'description', None),
        "created_at": str(getattr(user, 'created_at', '')),
    }
