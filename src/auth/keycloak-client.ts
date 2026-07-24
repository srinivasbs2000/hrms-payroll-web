import Keycloak from 'keycloak-js';
import type {
  KeycloakInitOptions,
  KeycloakLoginOptions,
  KeycloakLogoutOptions,
  KeycloakTokenParsed
} from 'keycloak-js';

export interface PayrollTokenClaims extends KeycloakTokenParsed {
  permissions?: string[] | string;
  tenant_id?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
}

export interface PayrollKeycloakClient {
  authenticated?: boolean;
  token?: string;
  tokenParsed?: PayrollTokenClaims;
  init(options:KeycloakInitOptions):Promise<boolean>;
  login(options?:KeycloakLoginOptions):Promise<void>;
  logout(options?:KeycloakLogoutOptions):Promise<void>;
  updateToken(minValidity:number):Promise<boolean>;
  clearToken():void;
  onAuthSuccess?:()=>void;
  onAuthLogout?:()=>void;
  onAuthRefreshSuccess?:()=>void;
  onAuthRefreshError?:()=>void;
  onTokenExpired?:()=>void;
}

type ViteEnvironment=Record<string,string|boolean|undefined>;

function environment():ViteEnvironment{
  const metadata=import.meta as ImportMeta&{readonly env?:ViteEnvironment};
  return metadata.env??{};
}

export function keycloakConfiguration(){
  const env=environment();
  return {
    url:String(env.VITE_KEYCLOAK_URL??'http://localhost:8081'),
    realm:String(env.VITE_KEYCLOAK_REALM??'payroll'),
    clientId:String(env.VITE_KEYCLOAK_CLIENT_ID??'payroll-web')
  };
}

export function keycloakInitializationOptions(
  origin=window.location.origin
):KeycloakInitOptions{
  return {
    onLoad:'check-sso',
    flow:'standard',
    responseMode:'query',
    pkceMethod:'S256',
    checkLoginIframe:false,
    silentCheckSsoRedirectUri:`${origin}/silent-check-sso.html`,
    silentCheckSsoFallback:true,
    enableLogging:false
  };
}

export function createPayrollKeycloak():PayrollKeycloakClient{
  return new Keycloak(keycloakConfiguration()) as PayrollKeycloakClient;
}

export function initializePayrollKeycloak(
  client:PayrollKeycloakClient,
  origin=window.location.origin
):Promise<boolean>{
  return client.init(keycloakInitializationOptions(origin));
}
