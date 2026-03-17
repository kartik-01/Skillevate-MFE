import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

interface Props {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  return (
    <Auth0Provider
      domain="dev-dkdxpljfvflt1jgs.us.auth0.com"
      clientId="lzbVOYeSERkab4468jFAYWUABT4VvjwM"
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
      cacheLocation="localstorage" // ensures tokens persist across reloads
    >
      {children}
    </Auth0Provider>
  );
};
