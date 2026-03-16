import { getCookie } from "@tanstack/react-start/server";

export const getAuthToken = () => {
  const token = getCookie("auth-token");

  if (!token) return null;

  return token;
};
