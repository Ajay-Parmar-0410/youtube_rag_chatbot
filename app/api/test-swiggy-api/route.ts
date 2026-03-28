import { BROWSER_HEADERS, testUrl } from "@/lib/test-api-helper";

const URL =
  "https://www.swiggy.com/dapi/restaurants/list/v5" +
  "?lat=17.9793884&lng=79.5301976" +
  "&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING";

export async function GET() {
  return testUrl("swiggy-api", URL, BROWSER_HEADERS, true);
}
