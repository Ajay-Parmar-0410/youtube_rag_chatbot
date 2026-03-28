from __future__ import annotations

import logging
import time

import httpx
from fastapi import APIRouter

from models import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter()

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
}

TIMEOUT = 10.0


async def _test_url(
    url: str,
    headers: dict[str, str] | None = None,
    include_body: bool = False,
) -> dict:
    """Fetch a URL and return test result dict."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
        ) as client:
            response = await client.get(url, headers=headers or {})

        elapsed_ms = round((time.monotonic() - start) * 1000)
        blocked = response.status_code >= 400

        result: dict = {
            "status": response.status_code,
            "blocked": blocked,
            "time_ms": elapsed_ms,
            "headers": dict(response.headers),
        }

        if include_body:
            body_text = response.text[:500]
            result["dataReceived"] = len(response.text) > 0
            result["sampleData"] = body_text

        return result

    except httpx.TimeoutException:
        elapsed_ms = round((time.monotonic() - start) * 1000)
        return {
            "status": 0,
            "blocked": True,
            "time_ms": elapsed_ms,
            "error": "Request timed out after 10 seconds",
        }
    except Exception as exc:
        elapsed_ms = round((time.monotonic() - start) * 1000)
        return {
            "status": 0,
            "blocked": True,
            "time_ms": elapsed_ms,
            "error": str(exc),
        }


@router.get("/swiggy-basic")
async def test_swiggy_basic() -> ApiResponse:
    """Test Swiggy homepage accessibility."""
    result = await _test_url("https://www.swiggy.com")
    return ApiResponse(success=True, data={"test": "swiggy-basic", **result})


@router.get("/swiggy-api")
async def test_swiggy_api() -> ApiResponse:
    """Test Swiggy restaurant listing API."""
    url = (
        "https://www.swiggy.com/dapi/restaurants/list/v5"
        "?lat=17.9793884&lng=79.5301976"
        "&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING"
    )
    result = await _test_url(url, headers=BROWSER_HEADERS, include_body=True)
    return ApiResponse(success=True, data={"test": "swiggy-api", **result})


@router.get("/swiggy-search")
async def test_swiggy_search() -> ApiResponse:
    """Test Swiggy search API."""
    url = (
        "https://www.swiggy.com/dapi/restaurants/search/v3"
        "?lat=17.9793884&lng=79.5301976"
        "&str=biryani&trackingId=undefined&submitAction=ENTER"
    )
    result = await _test_url(url, headers=BROWSER_HEADERS, include_body=True)
    return ApiResponse(success=True, data={"test": "swiggy-search", **result})


@router.get("/zomato-basic")
async def test_zomato_basic() -> ApiResponse:
    """Test Zomato homepage accessibility."""
    result = await _test_url("https://www.zomato.com")
    return ApiResponse(success=True, data={"test": "zomato-basic", **result})


@router.get("/zomato-api")
async def test_zomato_api() -> ApiResponse:
    """Test Zomato search/suggestion API."""
    url = "https://www.zomato.com/webroutes/search/autoSuggest?query=biryani"
    headers = {
        "User-Agent": BROWSER_HEADERS["User-Agent"],
        "Accept": "application/json",
    }
    result = await _test_url(url, headers=headers, include_body=True)
    return ApiResponse(success=True, data={"test": "zomato-api", **result})
