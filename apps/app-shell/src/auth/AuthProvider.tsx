import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

interface Props {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const audience = process.env.AUTH0_AUDIENCE;

  return (
    <Auth0Provider
      domain="skillevate.us.auth0.com"
      clientId="zzG9pGUv9Ky29Lta4aI3YKCZiKQjk96q"
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(audience ? { audience } : {}),
      }}
      cacheLocation="localstorage" // ensures tokens persist across reloads
    >
      {children}
    </Auth0Provider>
  );
};
