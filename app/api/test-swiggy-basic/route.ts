import { testUrl } from "@/lib/test-api-helper";

export async function GET() {
  return testUrl("swiggy-basic", "https://www.swiggy.com");
}
