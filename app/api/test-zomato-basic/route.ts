import { testUrl } from "@/lib/test-api-helper";

export async function GET() {
  return testUrl("zomato-basic", "https://www.zomato.com");
}
