"use client";

import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = { credential: string };
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (configuration: { client_id: string; callback: (response: GoogleCredentialResponse) => void; ux_mode: "popup"; auto_select: false }) => void;
      renderButton: (element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; text: "continue_with"; shape: "rectangular"; width: number }) => void;
    };
  };
};

declare global { interface Window { google?: GoogleIdentity } }

type GoogleSignInButtonProps = { onCredential: (credential: string) => void; onError: (message: string) => void; disabled?: boolean };

export function GoogleSignInButton({ onCredential, onError, disabled = false }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) { onError("Google sign-in is not configured yet."); return; }
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "popup",
        auto_select: false,
        callback: ({ credential }) => credential ? onCredential(credential) : onError("Google did not return a sign-in credential."),
      });
      containerRef.current.replaceChildren();
      window.google.accounts.id.renderButton(containerRef.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: 350 });
      setReady(true);
    };
    const existingScript = document.getElementById("google-identity-services");
    if (window.google) render();
    else if (existingScript) existingScript.addEventListener("load", render);
    else {
      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render);
      script.addEventListener("error", () => onError("Unable to load Google sign-in."));
      document.head.appendChild(script);
    }
    return () => { cancelled = true; existingScript?.removeEventListener("load", render); };
  }, [clientId, onCredential, onError]);

  return <div aria-busy={!ready || disabled} aria-label="Continue with Google" ref={containerRef} style={{ minHeight: 44, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }} />;
}
