import { useRouteContext } from "@tanstack/react-router";

/** Utilisateur connecté + organisation, garantis non nuls sous la route `_app`. */
export function useAuth() {
  return useRouteContext({ from: "/_app" }).auth;
}

/** Pour l'affichage uniquement : la base refuse de toute façon ce qu'un non-admin n'a pas le droit de faire. */
export function useIsAdmin() {
  return useAuth().membership.role === "admin";
}
