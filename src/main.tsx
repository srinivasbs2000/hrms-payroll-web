import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {App} from './App';
import {AuthProvider} from './auth/AuthProvider';
import {
  createPayrollKeycloak,
  initializePayrollKeycloak
} from './auth/keycloak-client';
import './styles.css';

async function bootstrap():Promise<void>{
  const client=createPayrollKeycloak();
  let authenticated=false;
  let initializationError='';

  try{
    authenticated=await initializePayrollKeycloak(client);
  }catch(failure){
    initializationError=failure instanceof Error
      ?failure.message
      :'Keycloak authentication could not be initialized.';
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthProvider
        client={client}
        initialAuthenticated={authenticated}
        initializationError={initializationError}
      >
        <BrowserRouter>
          <App/>
        </BrowserRouter>
      </AuthProvider>
    </React.StrictMode>
  );
}

void bootstrap();
