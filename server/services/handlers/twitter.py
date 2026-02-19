"""Twitter/X node handlers using official XDK SDK."""

import time
from typing import Dict, Any
from xdk import Client

from core.logging import get_logger

logger = get_logger(__name__)


async def _get_twitter_client() -> Client:
    """Get authenticated Twitter client from stored OAuth 2.0 credentials."""
    # Import inside function to avoid circular import
    from core.container import container
    auth_service = container.auth_service()
    access_token = await auth_service.get_api_key("twitter_access_token")
    if not access_token:
        raise ValueError("Twitter not connected. Please authenticate via Credentials.")
    # Use access_token for OAuth 2.0 user token (not bearer_token which is app-only)
    return Client(access_token=access_token)


async def _get_my_user_id(client: Client) -> str:
    """Get the authenticated user's ID."""
    response = client.users.get_me()
    # response.data is a dict with 'id', 'username', 'name' keys
    return response.data["id"]


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

        match action:
            case 'tweet':
                text = parameters.get('text', '')
                if not text:
                    raise ValueError("Tweet text is required")
                # XDK API: client.posts.create(body={"text": "..."})
                payload = {"text": text[:280]}
                result = client.posts.create(body=payload)
                return _success(_format_response(result), "tweet_sent", start_time)

            case 'reply':
                text = parameters.get('text', '')
                reply_to = parameters.get('reply_to_id')
                if not text or not reply_to:
                    raise ValueError("Text and reply_to_id are required")
                # XDK API: reply uses nested reply object
                payload = {
                    "text": text[:280],
                    "reply": {"in_reply_to_tweet_id": reply_to}
                }
                result = client.posts.create(body=payload)
                return _success(_format_response(result), "reply_sent", start_time)

            case 'retweet':
                tweet_id = parameters.get('tweet_id')
                if not tweet_id:
                    raise ValueError("tweet_id is required")
                user_id = await _get_my_user_id(client)
                # XDK API: client.users.repost_post(user_id, body={"tweet_id": "..."})
                payload = {"tweet_id": tweet_id}
                result = client.users.repost_post(user_id, body=payload)
                return _success(_format_response(result), "retweeted", start_time)

            case 'like':
                tweet_id = parameters.get('tweet_id')
                if not tweet_id:
                    raise ValueError("tweet_id is required")
                user_id = await _get_my_user_id(client)
                # XDK API: client.users.like_post(user_id, body={"tweet_id": "..."})
                payload = {"tweet_id": tweet_id}
                result = client.users.like_post(user_id, body=payload)
                return _success(_format_response(result), "liked", start_time)

            case 'unlike':
                tweet_id = parameters.get('tweet_id')
                if not tweet_id:
                    raise ValueError("tweet_id is required")
                user_id = await _get_my_user_id(client)
                # XDK API: client.users.unlike_post(user_id, tweet_id=post_id)
                result = client.users.unlike_post(user_id, tweet_id=tweet_id)
                return _success(_format_response(result), "unliked", start_time)

            case 'delete':
                tweet_id = parameters.get('tweet_id')
                if not tweet_id:
                    raise ValueError("tweet_id is required")
                # XDK API: client.posts.delete(post_id)
                result = client.posts.delete(tweet_id)
                return _success(_format_response(result), "deleted", start_time)

            case _:
                raise ValueError(f"Unknown action: {action}")

    except Exception as e:
        logger.error(f"Twitter send error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


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
        max_results = min(parameters.get('max_results', 10), 100)

        if not query:
            raise ValueError("Search query is required")

        tweets = []
        # XDK API: client.posts.search_recent(query=..., max_results=..., tweet_fields=[...])
        for page in client.posts.search_recent(
            query=query,
            max_results=max_results,
            tweet_fields=["author_id", "created_at"]
        ):
            page_data = getattr(page, 'data', []) or []
            tweets.extend([_format_tweet(t) for t in page_data])
            break  # Only first page

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

        match operation:
            case 'me':
                # XDK API: client.users.get_me(user_fields=[...])
                result = client.users.get_me(user_fields=["created_at", "description"])
                return _success(_format_user_data(result.data), "user", start_time)

            case 'by_username':
                username = parameters.get('username')
                if not username:
                    raise ValueError("Username is required")
                # XDK API: client.users.get_by_usernames(usernames=[...], user_fields=[...])
                result = client.users.get_by_usernames(
                    usernames=[username],
                    user_fields=["description", "created_at"]
                )
                users = getattr(result, 'data', []) or []
                if not users:
                    raise ValueError(f"User @{username} not found")
                return _success(_format_user_data(users[0]), "user", start_time)

            case 'by_id':
                user_id = parameters.get('user_id')
                if not user_id:
                    raise ValueError("User ID is required")
                # XDK API: client.users.get_by_ids works similar
                result = client.users.get_by_ids(
                    ids=[user_id],
                    user_fields=["description", "created_at"]
                )
                users = getattr(result, 'data', []) or []
                if not users:
                    raise ValueError(f"User ID {user_id} not found")
                return _success(_format_user_data(users[0]), "user", start_time)

            case 'followers':
                user_id = parameters.get('user_id')
                if not user_id:
                    user_id = await _get_my_user_id(client)
                max_results = min(parameters.get('max_results', 100), 1000)
                users = []
                # XDK API: client.users.get_followers(user_id, max_results=..., user_fields=[...])
                for page in client.users.get_followers(
                    user_id,
                    max_results=max_results,
                    user_fields=["created_at"]
                ):
                    page_data = getattr(page, 'data', []) or []
                    users.extend([_format_user_data(u) for u in page_data])
                    break  # Only first page
                return _success({"users": users, "count": len(users)}, "followers", start_time)

            case 'following':
                user_id = parameters.get('user_id')
                if not user_id:
                    user_id = await _get_my_user_id(client)
                max_results = min(parameters.get('max_results', 100), 1000)
                users = []
                # XDK API: client.users.get_following(user_id, max_results=..., user_fields=[...])
                for page in client.users.get_following(
                    user_id,
                    max_results=max_results,
                    user_fields=["created_at"]
                ):
                    page_data = getattr(page, 'data', []) or []
                    users.extend([_format_user_data(u) for u in page_data])
                    break  # Only first page
                return _success({"users": users, "count": len(users)}, "following", start_time)

            case _:
                raise ValueError(f"Unknown operation: {operation}")

    except Exception as e:
        logger.error(f"Twitter user error: {e}")
        return {"success": False, "error": str(e), "execution_time": time.time() - start_time}


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


def _format_tweet(tweet) -> Dict[str, Any]:
    """Format tweet object/dict to dict."""
    if isinstance(tweet, dict):
        return {
            "id": tweet.get("id"),
            "text": tweet.get("text"),
            "author_id": tweet.get("author_id"),
            "created_at": str(tweet.get("created_at", "")),
        }
    return {
        "id": getattr(tweet, 'id', None),
        "text": getattr(tweet, 'text', None),
        "author_id": getattr(tweet, 'author_id', None),
        "created_at": str(getattr(tweet, 'created_at', '')),
    }


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
