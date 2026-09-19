import React, { Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './i18n';

import App from './App';
import Loading from './components/Loading';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
const queryClient = new QueryClient();

if (import.meta.env.PROD) {
    console.log = () => { };
}

root.render(
    <React.StrictMode>
        <Suspense fallback={<Loading />}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </Suspense>
    </React.StrictMode>
);
