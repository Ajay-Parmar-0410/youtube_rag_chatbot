import { BROWSER_HEADERS, testUrl } from "@/lib/test-api-helper";

const URL =
  "https://www.zomato.com/webroutes/search/autoSuggest?query=biryani";

export async function GET() {
  return testUrl("zomato-api", URL, {
    "User-Agent": BROWSER_HEADERS["User-Agent"],
    Accept: "application/json",
  }, true);
}
