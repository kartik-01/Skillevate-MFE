import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import ReactDOM from "react-dom/client";
import Widget from "./Widget";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const audience = process.env.AUTH0_AUDIENCE;

root.render(
  <Auth0Provider
    domain="skillevate.us.auth0.com"
    clientId="zzG9pGUv9Ky29Lta4aI3YKCZiKQjk96q"
    authorizationParams={{
      redirect_uri: window.location.origin,
      ...(audience ? { audience } : {}),
    }}
    cacheLocation="localstorage"
  >
    <Widget />
  </Auth0Provider>,
);
