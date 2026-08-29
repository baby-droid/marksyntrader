import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ChunkErrorPage from '@/components/error-component/chunk-error-boundary';
import ChunkLoader from '@/components/loader/chunk-loader';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { StoreProvider } from '@/hooks/useStore';
import { isPreviewMode, PREVIEW_BASE_PATH } from '@/utils/is-preview-mode';
import { localize, TranslationProvider } from '@deriv-com/translations';
import CoreStoreProvider from './CoreStoreProvider';
import i18nInstance from './i18n';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));
const CallbackPage = lazy(() => import('../pages/callback/callback'));
const DTraderPage = lazy(() => import('../pages/dtrader'));

const LanguageHandler = ({ children }: { children: React.ReactNode }) => {
    useLanguageFromURL();
    return <>{children}</>;
};

const routerBasename = isPreviewMode() ? PREVIEW_BASE_PATH : undefined;

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path='/'
            errorElement={<ChunkErrorPage />}
            element={
                <Suspense
                    fallback={<ChunkLoader message={localize('Please wait while we connect to the server...')} />}
                >
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <LanguageHandler>
                            <StoreProvider>
                                <LocalStorageSyncWrapper>
                                    <RoutePromptDialog />
                                    <CoreStoreProvider>
                                        <Layout />
                                    </CoreStoreProvider>
                                </LocalStorageSyncWrapper>
                            </StoreProvider>
                        </LanguageHandler>
                    </TranslationProvider>
                </Suspense>
            }
        >
            <Route index element={<AppRoot />} errorElement={<ChunkErrorPage />} />
            <Route path='preview' element={<AppRoot />} errorElement={<ChunkErrorPage />} />
            <Route
                path='dtrader'
                element={
                    <Suspense fallback={<ChunkLoader message={localize('Loading D-Trader...')} />}>
                        <DTraderPage />
                    </Suspense>
                }
                errorElement={<ChunkErrorPage />}
            />
            <Route
                path='callback'
                errorElement={<ChunkErrorPage />}
                element={
                    <Suspense fallback={<ChunkLoader message={localize('Completing login…')} />}>
                        <CallbackPage />
                    </Suspense>
                }
            />
        </Route>
    ),
    { basename: routerBasename }
);

function App() {
    useAccountSwitching();
    return <RouterProvider router={router} />;
}

export default App;
