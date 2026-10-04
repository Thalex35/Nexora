export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  return (
    validateNewPassword(password) ?? (password === confirmation ? null : "Passwords do not match.")
  );
}

export function passwordUpdateErrorMessage(status: number | undefined) {
  if (status === 422) {
    return "Choose a different password that meets the account password requirements.";
  }
  if (status === 401 || status === 403) {
    return "Your session could not be verified. Sign in again and retry.";
  }
  return "Couldn't update your password. Check your connection and try again.";
}

export function getRecoveryLinkMessage(search: string, hash: string) {
  const params = new URLSearchParams(`${search.replace(/^\?/, "")}&${hash.replace(/^#/, "")}`);
  const errorCode = params.get("error_code") ?? params.get("error");
  const description = params.get("error_description")?.toLocaleLowerCase() ?? "";
  if (errorCode === "otp_expired" || description.includes("expired")) {
    return "This password-reset link has expired. Request a new one to continue.";
  }
  if (errorCode || description) {
    return "This password-reset link is invalid or has already been used. Request a new one to continue.";
  }
  return null;
}

export function hasRecoveryCallback(search: string, hash: string) {
  const params = new URLSearchParams(`${search.replace(/^\?/, "")}&${hash.replace(/^#/, "")}`);
  return params.get("type") === "recovery" || params.has("code");
}
