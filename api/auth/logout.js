import { allowMethod, clearSessionCookie } from "../_lib/auth.js";
import { noStore } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["POST"])) return;
  clearSessionCookie(response);
  return response.status(200).json({ ok: true });
}
