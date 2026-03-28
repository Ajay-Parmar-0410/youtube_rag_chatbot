import { BROWSER_HEADERS, testUrl } from "@/lib/test-api-helper";

const URL =
  "https://www.swiggy.com/dapi/restaurants/search/v3" +
  "?lat=17.9793884&lng=79.5301976" +
  "&str=biryani&trackingId=undefined&submitAction=ENTER";

export async function GET() {
  return testUrl("swiggy-search", URL, BROWSER_HEADERS, true);
}
