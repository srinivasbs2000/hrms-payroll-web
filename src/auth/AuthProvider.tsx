import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type {PayrollKeycloakClient,PayrollTokenClaims} from './keycloak-client';

export interface PayrollAuthValue {
  authenticated:boolean;
  initializingError:string;
  busy:boolean;
  username:string;
  displayName:string;
  tenantId:string;
  permissions:Set<string>;
  login():Promise<void>;
  logout():Promise<void>;
  retryInitialization():void;
  hasPermission(permission:string):boolean;
}

interface AuthProviderProps {
  client:PayrollKeycloakClient;
  initialAuthenticated:boolean;
  initializationError?:string;
  children:ReactNode;
}

interface SessionSnapshot {
  authenticated:boolean;
  username:string;
  displayName:string;
  tenantId:string;
  permissions:string[];
}

const AuthContext=createContext<PayrollAuthValue|undefined>(undefined);

function normalizedPermissions(claims:PayrollTokenClaims|undefined):string[]{
  const raw=claims?.permissions;
  if(Array.isArray(raw)){
    return [...new Set(raw.filter(
      (permission):permission is string=>
        typeof permission==='string'&&permission.trim().length>0
    ))].sort();
  }
  if(typeof raw==='string'&&raw.trim().length>0){
    return [...new Set(raw.split(/[ ,]+/).filter(Boolean))].sort();
  }
  return [];
}

function snapshot(
  client:PayrollKeycloakClient,
  authenticated:boolean
):SessionSnapshot{
  const claims=client.tokenParsed;
  const username=typeof claims?.preferred_username==='string'
    ?claims.preferred_username
    :'';
  const displayName=typeof claims?.name==='string'&&claims.name.trim().length>0
    ?claims.name
    :username;
  const tenantId=typeof claims?.tenant_id==='string'?claims.tenant_id:'';
  return {
    authenticated,
    username,
    displayName,
    tenantId,
    permissions:normalizedPermissions(claims)
  };
}

function synchronizeWindowSession(
  client:PayrollKeycloakClient,
  current:SessionSnapshot
):void{
  if(current.authenticated&&client.token){
    window.payrollSession={
      accessToken:client.token,
      permissions:current.permissions
    };
    return;
  }
  delete window.payrollSession;
}

export function AuthProvider({
  client,
  initialAuthenticated,
  initializationError='',
  children
}:AuthProviderProps){
  const [current,setCurrent]=useState(()=>{
    const initial=snapshot(client,initialAuthenticated);
    synchronizeWindowSession(client,initial);
    return initial;
  });
  const [error,setError]=useState(initializationError);
  const [busy,setBusy]=useState(false);

  const applyClientState=useCallback(()=>{
    const next=snapshot(client,client.authenticated===true);
    synchronizeWindowSession(client,next);
    setCurrent(next);
    if(next.authenticated)setError('');
  },[client]);

  const resetSession=useCallback((message='')=>{
    const next=snapshot(client,false);
    synchronizeWindowSession(client,next);
    setCurrent(next);
    setError(message);
  },[client]);

  const expireSession=useCallback((message:string)=>{
    client.clearToken();
    resetSession(message);
  },[client,resetSession]);

  const refresh=useCallback(async()=>{
    if(client.authenticated!==true)return;
    try{
      await client.updateToken(45);
      applyClientState();
    }catch{
      expireSession('Your session expired. Sign in again to continue.');
    }
  },[applyClientState,client,expireSession]);

  useEffect(()=>{
    applyClientState();

    const previousAuthSuccess=client.onAuthSuccess;
    const previousAuthLogout=client.onAuthLogout;
    const previousRefreshSuccess=client.onAuthRefreshSuccess;
    const previousRefreshError=client.onAuthRefreshError;
    const previousTokenExpired=client.onTokenExpired;

    client.onAuthSuccess=applyClientState;
    client.onAuthLogout=()=>resetSession();
    client.onAuthRefreshSuccess=applyClientState;
    client.onAuthRefreshError=()=>
      expireSession('Your session could not be refreshed. Sign in again.');
    client.onTokenExpired=()=>{void refresh()};

    const timer=window.setInterval(()=>{void refresh()},15_000);

    return ()=>{
      window.clearInterval(timer);
      client.onAuthSuccess=previousAuthSuccess;
      client.onAuthLogout=previousAuthLogout;
      client.onAuthRefreshSuccess=previousRefreshSuccess;
      client.onAuthRefreshError=previousRefreshError;
      client.onTokenExpired=previousTokenExpired;
    };
  },[applyClientState,client,expireSession,refresh,resetSession]);

  const login=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      await client.login({redirectUri:window.location.href});
    }catch(failure){
      setError(failure instanceof Error
        ?failure.message
        :'Keycloak sign-in could not be started.');
    }finally{
      setBusy(false);
    }
  },[client]);

  const logout=useCallback(async()=>{
    setBusy(true);
    resetSession();
    try{
      await client.logout({redirectUri:`${window.location.origin}/`});
      client.clearToken();
      resetSession();
    }catch(failure){
      client.clearToken();
      resetSession(failure instanceof Error
        ?failure.message
        :'Keycloak sign-out could not be completed.');
    }finally{
      setBusy(false);
    }
  },[client,resetSession]);

  const retryInitialization=useCallback(()=>{
    window.location.reload();
  },[]);

  const permissions=useMemo(
    ()=>new Set(current.permissions),
    [current.permissions]
  );

  const value=useMemo<PayrollAuthValue>(()=>({
    authenticated:current.authenticated,
    initializingError:error,
    busy,
    username:current.username,
    displayName:current.displayName,
    tenantId:current.tenantId,
    permissions,
    login,
    logout,
    retryInitialization,
    hasPermission:permission=>permissions.has(permission)
  }),[
    busy,
    current.authenticated,
    current.displayName,
    current.tenantId,
    current.username,
    error,
    login,
    logout,
    permissions,
    retryInitialization
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth():PayrollAuthValue{
  const context=useContext(AuthContext);
  if(!context)throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
