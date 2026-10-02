const SINGLE_USER_MODE = import.meta.env["VITE_NEXORA_SINGLE_USER_MODE"] !== "false";
const AUTHORIZED_USER_ID = import.meta.env["VITE_NEXORA_AUTHORIZED_USER_ID"]?.trim();

export function isAuthorizedUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return !SINGLE_USER_MODE || (!!AUTHORIZED_USER_ID && userId === AUTHORIZED_USER_ID);
}
