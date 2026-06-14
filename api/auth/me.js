import { allowMethod, readSession } from "../_lib/auth.js";
import { noStore } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  const user = readSession(request);
  return response.status(200).json({ user });
}
