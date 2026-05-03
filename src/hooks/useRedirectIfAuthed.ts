import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";

/**
 * Redirects to dashboard if already signed in.
 * `block` is true while session is loading or while a user exists (briefly before navigation unmounts the page).
 */
export function useRedirectIfAuthed() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  return { block: loading || !!user };
}
